"""Audio and video file transcription loader."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.models import Source
from gtm_api.services.loaders.base import page_from_text
from gtm_api.services.storage import storage_service

settings = get_settings()


class AudioVideoLoader:
    async def load(self, source: Source, db: AsyncSession) -> list:
        if not source.storage_key:
            raise ValueError("Media source missing storage_key")

        data = storage_service.get_object(source.storage_key)
        filename = source.display_name or Path(source.storage_key).name
        ext = Path(filename).suffix.lower()

        with tempfile.TemporaryDirectory() as tmp:
            input_path = Path(tmp) / f"input{ext}"
            input_path.write_bytes(data)
            audio_path = input_path

            if source.source_type.value == "video" or ext in (".mp4", ".mov", ".webm", ".mkv"):
                audio_path = Path(tmp) / "audio.wav"
                if not shutil.which("ffmpeg"):
                    raise ValueError(
                        "ffmpeg is required for video transcription. Install ffmpeg or upload audio only."
                    )
                subprocess.run(
                    [
                        "ffmpeg", "-y", "-i", str(input_path),
                        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                        str(audio_path),
                    ],
                    check=True,
                    capture_output=True,
                )

            transcript = self._transcribe(audio_path)
            url = source.url or f"file://{filename}"
            title = f"Transcript: {filename}"
            content = f"# {title}\n\n## Transcript\n\n{transcript}"
            return [page_from_text(url, title, content)]

    def _transcribe(self, audio_path: Path) -> str:
        if not settings.whisper_enabled:
            return (
                "(Whisper transcription disabled. Set WHISPER_ENABLED=true and install openai-whisper "
                "to transcribe audio/video files.)"
            )
        try:
            import whisper
        except ImportError as exc:
            raise ValueError(
                "Install openai-whisper for audio transcription: pip install openai-whisper"
            ) from exc

        model = whisper.load_model("base")
        result = model.transcribe(str(audio_path))
        return result.get("text", "").strip() or "(empty transcript)"
