"""Tests for source loaders and validation."""

import pytest

from gtm_api.services.loaders.base import is_youtube_url, page_from_text
from gtm_api.services.loaders.spreadsheet import SpreadsheetLoader
from gtm_api.services.loaders.youtube import extract_video_id
from gtm_api.services.source_service import validate_source_type


class TestSourceValidation:
    def test_valid_types(self):
        assert validate_source_type("website") is not None
        assert validate_source_type("file").value == "file"

    def test_invalid_type(self):
        with pytest.raises(ValueError):
            validate_source_type("invalid")


class TestYouTubeHelpers:
    def test_extract_watch_url(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_extract_short_url(self):
        assert extract_video_id("https://youtu.be/abc123XYZ") == "abc123XYZ"

    def test_is_youtube(self):
        assert is_youtube_url("https://youtube.com/watch?v=x")
        assert not is_youtube_url("https://example.com")


class TestPageFromText:
    def test_creates_page(self):
        page = page_from_text("https://example.com", "Title", "Hello world")
        assert page.title == "Title"
        assert "Hello" in page.content
        assert len(page.content_hash) == 64


class TestSpreadsheetLoader:
    def test_csv_to_markdown(self):
        loader = SpreadsheetLoader()
        data = b"name,role\nAlice,admin\nBob,user\n"
        md = loader._csv_to_markdown(data)
        assert "Alice" in md
        assert "admin" in md
        assert "|" in md
