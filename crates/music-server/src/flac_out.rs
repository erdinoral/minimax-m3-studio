//! Lossless FLAC for the songs the studio keeps.
//!
//! For FLAC the engine is asked for its float WAV, which it hands over at the
//! level the model made it (the engine skips its peak normalisation for
//! float output), and the studio encodes that once into 24-bit FLAC with the
//! sample count and MD5 in the stream header. Every WAV the engine sends is
//! checked first, so a broken render is refused instead of kept.

use anyhow::{anyhow, bail, Context, Result};
use flacenc::component::BitRepr;
use flacenc::error::Verify;

/// Reads a WAV of any sample format into interleaved floats, its channel count and rate.
pub fn read_wav(wav: &[u8]) -> Result<(Vec<f32>, u16, u32)> {
    let mut reader = hound::WavReader::new(std::io::Cursor::new(wav)).context("read the engine's WAV")?;
    let spec = reader.spec();
    let samples = match spec.sample_format {
        hound::SampleFormat::Float => reader.samples::<f32>().collect::<Result<Vec<_>, _>>()?,
        hound::SampleFormat::Int => {
            let full = (1i64 << (spec.bits_per_sample - 1)) as f32;
            reader.samples::<i32>().map(|sample| sample.map(|value| value as f32 / full)).collect::<Result<Vec<_>, _>>()?
        }
    };
    Ok((samples, spec.channels, spec.sample_rate))
}

/// The gain that fits a float signal into an integer format: 1 when its peak
/// is within full scale, else exactly enough to bring the peak to it. An
/// integer sample cannot hold more, and cutting the overs would distort.
pub fn fitting_gain(samples: &[f32]) -> f32 {
    let peak = samples.iter().filter(|sample| sample.is_finite()).fold(0.0f32, |peak, sample| peak.max(sample.abs()));
    if peak > 1.0 { 1.0 / peak } else { 1.0 }
}

/// Encodes interleaved float samples as 24-bit FLAC.
pub fn encode(samples: &[f32], channels: u16, rate: u32) -> Result<Vec<u8>> {
    const FULL: f32 = 8_388_607.0;
    if channels == 0 || samples.len() % channels as usize != 0 {
        bail!("the track's samples do not divide into its {channels} channels");
    }
    let gain = fitting_gain(samples);
    let integers: Vec<i32> = samples
        .iter()
        .map(|sample| if sample.is_finite() { *sample } else { 0.0 })
        .map(|sample| ((sample * gain).clamp(-1.0, 1.0) * FULL).round() as i32)
        .collect();
    let config = flacenc::config::Encoder::default().into_verified().map_err(|(_, error)| anyhow!("FLAC encoder settings: {error:?}"))?;
    let source = flacenc::source::MemSource::from_samples(&integers, channels as usize, 24, rate as usize);
    let stream = flacenc::encode_with_fixed_block_size(&config, source, config.block_size).map_err(|error| anyhow!("encode FLAC: {error:?}"))?;
    let mut sink = flacenc::bitsink::ByteSink::new();
    stream.write(&mut sink).map_err(|error| anyhow!("write FLAC: {error:?}"))?;
    Ok(sink.as_slice().to_vec())
}

/// What is wrong with a track the engine sent, if anything: samples that are
/// not numbers, silence, or one level held from start to end.
pub fn output_problem(samples: &[f32]) -> Option<&'static str> {
    let (mut low, mut high) = (f32::INFINITY, f32::NEG_INFINITY);
    for sample in samples {
        if !sample.is_finite() {
            return Some("samples that are not numbers");
        }
        low = low.min(*sample);
        high = high.max(*sample);
    }
    if low > high || low.abs().max(high.abs()) < 1e-5 {
        Some("silence")
    } else if high - low < 1e-6 {
        Some("one level held from start to end")
    } else {
        None
    }
}

/// Playable length from the STREAMINFO block every FLAC starts with.
pub fn duration_seconds(flac: &[u8]) -> Option<f64> {
    if flac.get(..4)? != b"fLaC" || flac.get(4)? & 0x7f != 0 {
        return None;
    }
    let info = flac.get(8..8 + 34)?;
    let rate = (u32::from(info[10]) << 12) | (u32::from(info[11]) << 4) | (u32::from(info[12]) >> 4);
    let total = (u64::from(info[13] & 0x0f) << 32) | u64::from(u32::from_be_bytes(info[14..18].try_into().ok()?));
    (rate > 0 && total > 0).then(|| total as f64 / f64::from(rate))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn float_wav(samples: &[f32], rate: u32) -> Vec<u8> {
        let spec = hound::WavSpec { channels: 2, sample_rate: rate, bits_per_sample: 32, sample_format: hound::SampleFormat::Float };
        let mut cursor = std::io::Cursor::new(Vec::new());
        let mut writer = hound::WavWriter::new(&mut cursor, spec).unwrap();
        for sample in samples {
            writer.write_sample(*sample).unwrap();
        }
        writer.finalize().unwrap();
        cursor.into_inner()
    }

    #[test]
    fn a_float_wav_becomes_a_flac_of_the_same_length() {
        let samples: Vec<f32> = (0..44_100 * 2).map(|index| ((index / 2) as f32 * 0.05).sin() * 0.5).collect();
        let (read, channels, rate) = read_wav(&float_wav(&samples, 44_100)).unwrap();
        let flac = encode(&read, channels, rate).unwrap();
        assert_eq!(&flac[..4], b"fLaC");
        assert!((duration_seconds(&flac).unwrap() - 1.0).abs() < 1e-6);
    }

    #[test]
    fn a_broken_engine_track_is_named() {
        let tone: Vec<f32> = (0..4_800).map(|index| 0.3 * (index as f32 * 0.05).sin()).collect();
        assert_eq!(output_problem(&tone), None);
        assert_eq!(output_problem(&[0.0; 4_800]), Some("silence"));
        assert_eq!(output_problem(&[-1.0; 4_800]), Some("one level held from start to end"));
        let mut broken = tone.clone();
        broken[100] = f32::NAN;
        assert_eq!(output_problem(&broken), Some("samples that are not numbers"));
    }

    #[test]
    fn a_peak_above_full_scale_is_lowered_not_cut() {
        assert_eq!(fitting_gain(&[0.5, -0.9]), 1.0);
        assert_eq!(fitting_gain(&[2.0, -1.0, f32::NAN]), 0.5);
    }
}
