"""Tests for the Imaging Embedding Service.

This module contains unit tests for the imaging embedding service that integrates
capabilities from heartAI-main project.
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch
from uuid import uuid4

import numpy as np
import pytest

# The embedder runs on PyTorch, an optional ML dependency that the default install leaves out.
pytest.importorskip("torch")

from app.cardiotwin.services.imaging_embedding import (  # noqa: E402
    CardiacImagingEmbedder,
    ImagingEmbeddingMetadata,
    ImagingEmbeddingResult,
)

# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture
def temp_nifti_file():
    """Create a temporary mock NIfTI file for testing."""
    with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as f:
        # Write a small mock NIfTI-like file
        # This is a minimal header that some libraries will recognize
        header = bytearray(348)  # NIfTI-1 header size
        header[0:4] = b'\x6e\x2b\x31\x00'  # NIfTI-1 magic number (little-endian)
        header[4:8] = b'\x00\x00\x00\x00'  # sizeof_hdr
        # Write some mock data
        mock_data = np.random.rand(10, 10, 10).astype(np.float32).tobytes()
        f.write(header + mock_data)
        f.flush()
        yield f.name
        # Cleanup
        Path(f.name).unlink(missing_ok=True)


@pytest.fixture
def temp_dicom_file():
    """Create a temporary mock DICOM file for testing."""
    with tempfile.NamedTemporaryFile(suffix=".dcm", delete=False) as f:
        # Write a minimal DICOM file
        # This is not a valid DICOM but will be recognized by file extension
        f.write(b'DICM' + b'\x00' * 100)
        f.flush()
        yield f.name
        # Cleanup
        Path(f.name).unlink(missing_ok=True)


@pytest.fixture
def imaging_embedding_service():
    """Create an CardiacImagingEmbedder instance for testing."""
    with tempfile.TemporaryDirectory() as temp_dir:
        service = CardiacImagingEmbedder(
            temp_dir=temp_dir,
            model_cache_dir=temp_dir,
        )
        yield service


# =============================================================================
# TESTS: CardiacImagingEmbedder Initialization
# =============================================================================

class TestCardiacImagingEmbedderInitialization:
    """Test CardiacImagingEmbedder initialization."""

    def test_init_default(self):
        """Test service initialization with default parameters."""
        with tempfile.TemporaryDirectory() as temp_dir:
            service = CardiacImagingEmbedder(temp_dir=temp_dir)
            assert service is not None
            assert service.temp_dir == temp_dir
            assert service.model_cache_dir is not None

    def test_init_with_config(self):
        """Test service initialization with custom configuration."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = {
                "normalize": True,
                "resize": [128, 128, 128],
                "crop": True,
            }
            service = CardiacImagingEmbedder(
                temp_dir=temp_dir,
                default_config=config,
            )
            assert service.default_config == config


# =============================================================================
# TESTS: ImagingEmbeddingMetadata
# =============================================================================

class TestImagingEmbeddingMetadata:
    """Test the ImagingEmbeddingMetadata class."""

    def test_load_nifti_mock(self, temp_nifti_file):
        """Test loading a mock NIfTI file."""
        preprocessor = ImagingEmbeddingMetadata()

        # Mock the nibabel library
        with patch('nibabel.load') as mock_load:
            mock_img = MagicMock()
            mock_img.get_fdata.return_value = np.random.rand(10, 10, 10)
            mock_img.affine = np.eye(4)
            mock_load.return_value = mock_img

            result = preprocessor.load_nifti(temp_nifti_file)

            assert result is not None
            mock_load.assert_called_once()

    def test_load_dicom_mock(self, temp_dicom_file):
        """Test loading a mock DICOM file."""
        preprocessor = ImagingEmbeddingMetadata()

        # Mock the pydicom library
        with patch('pydicom.dcmread') as mock_read:
            mock_ds = MagicMock()
            mock_ds.pixel_array = np.random.rand(10, 10)
            mock_read.return_value = mock_ds

            result = preprocessor.load_dicom(temp_dicom_file)

            assert result is not None
            mock_read.assert_called_once()

    def test_normalize_volume(self):
        """Test volume normalization."""
        preprocessor = ImagingEmbeddingMetadata()

        volume = np.array([[[1.0, 2.0], [3.0, 4.0]]])
        normalized = preprocessor.normalize_volume(volume)

        assert normalized is not None
        assert normalized.shape == volume.shape
        # Check that values are normalized to [0, 1] range
        assert normalized.min() >= 0
        assert normalized.max() <= 1

    def test_resize_volume(self):
        """Test volume resizing."""
        preprocessor = ImagingEmbeddingMetadata()

        volume = np.ones((10, 10, 10))
        resized = preprocessor.resize_volume(volume, target_size=(5, 5, 5))

        assert resized is not None
        assert resized.shape == (5, 5, 5)


# =============================================================================
# TESTS: ImagingEmbeddingResult
# =============================================================================

class TestImagingEmbeddingResult:
    """Test the ImagingEmbeddingResult class."""

    def test_init_default(self):
        """Test model initialization with default parameters."""
        model = ImagingEmbeddingResult()
        assert model is not None
        assert model.embedding_dim == 512  # Default dimension

    def test_init_custom_dim(self):
        """Test model initialization with custom embedding dimension."""
        model = ImagingEmbeddingResult(embedding_dim=256)
        assert model.embedding_dim == 256


# =============================================================================
# TESTS: CardiacImagingEmbedder Core Functions
# =============================================================================

class TestCardiacImagingEmbedderCore:
    """Test core CardiacImagingEmbedder functions."""

    def test_generate_embedding_mock(self, imaging_embedding_service, temp_nifti_file):
        """Test generating embedding from file with mocked dependencies."""
        with patch.object(ImagingEmbeddingMetadata, 'load_nifti') as mock_load, \
             patch.object(ImagingEmbeddingMetadata, 'normalize_volume') as mock_norm, \
             patch.object(ImagingEmbeddingMetadata, 'resize_volume') as mock_resize, \
             patch.object(ImagingEmbeddingResult, 'generate') as mock_generate:

            # Setup mocks
            mock_volume = np.random.rand(10, 10, 10)
            mock_load.return_value = mock_volume
            mock_norm.return_value = mock_volume
            mock_resize.return_value = mock_volume
            mock_generate.return_value = np.random.rand(512)

            result = imaging_embedding_service.generate_embedding(
                file_path=temp_nifti_file,
                modality="MRI",
            )

            assert result is not None
            assert "embedding" in result
            assert "metadata" in result

    def test_upload_and_process_mock(self, imaging_embedding_service, temp_nifti_file):
        """Test upload and process function with mocked dependencies."""
        with patch.object(CardiacImagingEmbedder, 'generate_embedding') as mock_gen:
            mock_gen.return_value = {
                "embedding": np.random.rand(512).tolist(),
                "metadata": {"modality": "MRI"},
                "quality_score": 0.95,
            }

            task_id = imaging_embedding_service.upload_and_process(
                file_path=temp_nifti_file,
                metadata={"patient_id": str(uuid4())},
            )

            assert task_id is not None
            assert isinstance(task_id, str)

    def test_get_status(self, imaging_embedding_service):
        """Test getting task status."""
        # First create a task by uploading
        with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as f:
            f.write(b'mock data')
            f.flush()

            task_id = imaging_embedding_service.upload_and_process(
                file_path=f.name,
                metadata={},
            )

            status = imaging_embedding_service.get_status(task_id)

            assert status is not None
            assert "task_id" in status
            assert "status" in status

    def test_health_check(self, imaging_embedding_service):
        """Test service health check."""
        health = imaging_embedding_service.health_check()

        assert health is not None
        assert "status" in health
        assert health["status"] in ["healthy", "degraded"]


# =============================================================================
# TESTS: Configuration Handling
# =============================================================================

class TestConfigurationHandling:
    """Test configuration handling."""

    def test_default_config(self, imaging_embedding_service):
        """Test default configuration."""
        config = imaging_embedding_service.get_config()

        assert config is not None
        assert "normalize" in config
        assert "resize" in config

    def test_custom_config(self):
        """Test custom configuration."""
        with tempfile.TemporaryDirectory() as temp_dir:
            custom_config = {
                "normalize": False,
                "resize": [64, 64, 64],
                "crop": False,
            }
            service = CardiacImagingEmbedder(
                temp_dir=temp_dir,
                default_config=custom_config,
            )

            config = service.get_config()
            assert config == custom_config


# =============================================================================
# TESTS: Error Handling
# =============================================================================

class TestErrorHandling:
    """Test error handling."""

    def test_invalid_file_type(self, imaging_embedding_service):
        """Test handling invalid file type."""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            f.write(b'not a medical image')
            f.flush()

            with pytest.raises(Exception) as exc_info:
                imaging_embedding_service.generate_embedding(
                    file_path=f.name,
                    modality="MRI",
                )

            assert "Unsupported file type" in str(exc_info.value) or \
                   "Invalid" in str(exc_info.value)

    def test_file_not_found(self, imaging_embedding_service):
        """Test handling file not found error."""
        with pytest.raises(Exception) as exc_info:
            imaging_embedding_service.generate_embedding(
                file_path="/nonexistent/file.nii.gz",
                modality="MRI",
            )

        assert "File not found" in str(exc_info.value) or \
               "No such file" in str(exc_info.value)


# =============================================================================
# INTEGRATION TESTS
# =============================================================================

class TestIntegration:
    """Integration tests for the imaging embedding service."""

    def test_complete_workflow(self, imaging_embedding_service):
        """Test a complete workflow: upload, process, retrieve status."""
        with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as f:
            # Create a mock NIfTI file
            f.write(b'\x6e\x2b\x31\x00' + b'\x00' * 500)
            f.flush()

            # Step 1: Upload and process
            task_id = imaging_embedding_service.upload_and_process(
                file_path=f.name,
                metadata={"patient_id": "test-patient"},
            )

            assert task_id is not None

            # Step 2: Check status
            status = imaging_embedding_service.get_status(task_id)

            assert status is not None
            assert status["task_id"] == task_id

            # Step 3: Health check
            health = imaging_embedding_service.health_check()

            assert health["status"] == "healthy"


# =============================================================================
# MAIN TEST EXECUTION
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
