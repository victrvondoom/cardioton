"""Cardiac Imaging Embedding Service.

This service provides embedding generation for cardiac imaging data (NIfTI files).
It is extracted and adapted from heartAI-main's embeddings.py module.

Original source: heartAI-main/api2/embeddings.py
License: MIT (Copyright (c) 2025 Ethan Tam)

Adaptations for CardioTwin:
- Changed from generic medical imaging to cardiac-specific
- Integrated with canonical CardiacCase domain model
- Added proper error handling and validation
- Added support for different cardiac imaging modalities

Dependencies:
- nibabel: For loading NIfTI files
- numpy: For numerical operations
- torch: For deep learning models
- monai: For medical imaging preprocessing
"""

from __future__ import annotations

import base64
import io
from pathlib import Path
from typing import Any, BinaryIO

import numpy as np
import torch
from pydantic import BaseModel
from torch import nn

from app.cardiotwin.models import DataProvenance, ModalityType

try:
    import nibabel as nib
    from monai.transforms import Compose, Resize, ScaleIntensity, ToTensor
    NIBABEL_AVAILABLE = True
except ImportError:
    NIBABEL_AVAILABLE = False
    nib = None


class ImagingEmbeddingError(Exception):
    """Exception raised when imaging embedding generation fails."""
    pass


class CardiacImagingEmbedder:
    """Generates embeddings for cardiac imaging data.

    This class encapsulates a 3D CNN + Transformer model for generating
    vector embeddings from cardiac imaging studies (CMR, CT, etc.).

    The model architecture:
    - 3D Convolutional layers for spatial feature extraction
    - Transformer encoder for capturing complex relationships
    - Adaptive pooling for fixed-size output

    Supports:
    - NIfTI format medical images
    - Base64 encoded image data
    - File path based loading
    """

    def __init__(
        self,
        device: str | None = None,
        model_weights: str | Path | None = None
    ):
        """Initialize the cardiac imaging embedder.

        Args:
            device: PyTorch device ('cuda', 'cpu', or None for auto-detection)
            model_weights: Path to pretrained weights (optional)
        """
        if not NIBABEL_AVAILABLE:
            raise ImportError(
                "nibabel and monai are required for imaging embedding. "
                "Install with: pip install nibabel monai"
            )

        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = self._build_model().to(self.device)

        # Load weights if provided
        if model_weights:
            self.load_weights(model_weights)

        # Preprocessing pipeline
        # Standardize to 128x128x64 for cardiac imaging
        self.preprocess = Compose([
            Resize(spatial_size=(128, 128, 64)),
            ScaleIntensity(minv=0.0, maxv=1.0),
            ToTensor(dtype=torch.float32)
        ])

        self._is_initialized = True

    def _build_model(self) -> nn.Sequential:
        """Build the 3D CNN + Transformer model.

        Returns:
            PyTorch Sequential model for embedding generation
        """
        return nn.Sequential(
            # Initial 3D convolutions
            nn.Conv3d(1, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool3d(2),

            # Intermediate layers
            nn.Conv3d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool3d(2),

            # Deeper layers
            nn.Conv3d(128, 256, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv3d(256, 512, kernel_size=3, padding=1),
            nn.ReLU(),

            # Flatten and transform
            nn.Flatten(start_dim=2),
            nn.Linear(16384, 512),

            # Transformer for complex pattern recognition
            nn.TransformerEncoder(
                nn.TransformerEncoderLayer(
                    d_model=512,
                    nhead=8,
                    dim_feedforward=2048,
                    batch_first=True
                ),
                num_layers=6
            ),

            # Final pooling and embedding
            nn.AdaptiveAvgPool1d(1),
            nn.Flatten()
        )

    def load_weights(self, weights_path: str | Path) -> None:
        """Load model weights from a file.

        Args:
            weights_path: Path to the weights file
        """
        try:
            self.model.load_state_dict(torch.load(weights_path, map_location=self.device))
            self.model.eval()
        except Exception as e:
            raise ImagingEmbeddingError(f"Failed to load weights: {e}") from e

    def load_nifti(self, path: str | Path) -> torch.Tensor:
        """Load a NIfTI file from disk.

        Args:
            path: Path to the NIfTI file

        Returns:
            Preprocessed tensor ready for embedding
        """
        try:
            img = nib.load(path)
            data = img.get_fdata().astype(np.float32)
            return self.preprocess(data[np.newaxis, ...])  # add channel
        except Exception as e:
            raise ImagingEmbeddingError(f"Failed to load NIfTI file: {e}") from e

    def load_nifti_from_base64(self, base64_string: str) -> torch.Tensor:
        """Load a NIfTI file from base64 encoded string.

        Args:
            base64_string: Base64 encoded NIfTI file content

        Returns:
            Preprocessed tensor ready for embedding
        """
        try:
            # Decode base64
            nifti_data = base64.b64decode(base64_string)

            # Create file map for nibabel
            file_map = nib.Nifti1Image.make_file_map()
            file_map["image"].fileobj = io.BytesIO(nifti_data)

            # Load image
            img = nib.Nifti1Image.from_file_map(file_map)
            data = img.get_fdata().astype(np.float32)

            return self.preprocess(data[np.newaxis, ...])
        except Exception as e:
            raise ImagingEmbeddingError(f"Failed to load NIfTI from base64: {e}") from e

    def load_nifti_from_bytes(self, nifti_bytes: bytes) -> torch.Tensor:
        """Load a NIfTI file from bytes.

        Args:
            nifti_bytes: Raw bytes of NIfTI file

        Returns:
            Preprocessed tensor ready for embedding
        """
        try:
            file_map = nib.Nifti1Image.make_file_map()
            file_map["image"].fileobj = io.BytesIO(nifti_bytes)
            img = nib.Nifti1Image.from_file_map(file_map)
            data = img.get_fdata().astype(np.float32)
            return self.preprocess(data[np.newaxis, ...])
        except Exception as e:
            raise ImagingEmbeddingError(f"Failed to load NIfTI from bytes: {e}") from e

    def load_nifti_from_file_object(self, file_obj: BinaryIO) -> torch.Tensor:
        """Load a NIfTI file from a file-like object.

        Args:
            file_obj: File-like object (e.g., from UploadFile)

        Returns:
            Preprocessed tensor ready for embedding
        """
        try:
            content = file_obj.read()
            return self.load_nifti_from_bytes(content)
        except Exception as e:
            raise ImagingEmbeddingError(f"Failed to load NIfTI from file object: {e}") from e

    def generate_embedding(self, tensor_input: torch.Tensor) -> np.ndarray[Any, Any]:
        """Generate embedding from preprocessed tensor.

        Args:
            tensor_input: Preprocessed input tensor (batch, channel, depth, height, width)

        Returns:
            Numpy array of embeddings
        """
        try:
            x = tensor_input.unsqueeze(0).to(self.device)
            with torch.no_grad():
                return np.asarray(self.model(x).cpu().numpy())
        except Exception as e:
            raise ImagingEmbeddingError(f"Failed to generate embedding: {e}") from e

    def __call__(self, path: str | Path) -> np.ndarray[Any, Any]:
        """Generate embedding from file path.

        Args:
            path: Path to the NIfTI file

        Returns:
            Embedding as numpy array
        """
        x = self.load_nifti(path).unsqueeze(0).to(self.device)
        with torch.no_grad():
            return np.asarray(self.model(x).cpu().numpy())

    def embedding_from_base64(self, base64_string: str) -> np.ndarray[Any, Any]:
        """Generate embedding directly from base64 string.

        Args:
            base64_string: Base64 encoded NIfTI file

        Returns:
            Embedding as numpy array
        """
        x = self.load_nifti_from_base64(base64_string).unsqueeze(0).to(self.device)
        with torch.no_grad():
            return np.asarray(self.model(x).cpu().numpy())

    def embedding_from_bytes(self, nifti_bytes: bytes) -> np.ndarray[Any, Any]:
        """Generate embedding from raw bytes.

        Args:
            nifti_bytes: Raw bytes of NIfTI file

        Returns:
            Embedding as numpy array
        """
        x = self.load_nifti_from_bytes(nifti_bytes).unsqueeze(0).to(self.device)
        with torch.no_grad():
            return np.asarray(self.model(x).cpu().numpy())

    def get_embedding_dim(self) -> int:
        """Get the dimension of the embedding.

        Returns:
            Dimension of embedding vector
        """
        # Create a dummy input to determine output dimension
        dummy_input = torch.zeros((1, 1, 64, 64, 64), dtype=torch.float32).to(self.device)
        with torch.no_grad():
            output = self.model(dummy_input)
        return int(output.shape[1])


# Singleton instance
_embedder: CardiacImagingEmbedder | None = None


def get_imaging_embedder(
    device: str | None = None,
    model_weights: str | Path | None = None
) -> CardiacImagingEmbedder:
    """Get the singleton imaging embedder instance.

    Args:
        device: PyTorch device (optional, uses existing if already initialized)
        model_weights: Path to weights (optional)

    Returns:
        Initialized CardiacImagingEmbedder instance
    """
    global _embedder
    if _embedder is None:
        _embedder = CardiacImagingEmbedder(device=device, model_weights=model_weights)
    return _embedder


def generate_cardiac_embedding(
    nifti_data: bytes | str | Path,
    from_base64: bool = False
) -> np.ndarray[Any, Any]:
    """Generate cardiac imaging embedding.

    Convenience function for generating embeddings from various input types.

    Args:
        nifti_data: NIfTI data (bytes, base64 string, or path)
        from_base64: If True, interpret nifti_data as base64 string

    Returns:
        Embedding as numpy array
    """
    embedder = get_imaging_embedder()

    if from_base64:
        if not isinstance(nifti_data, str):
            raise ImagingEmbeddingError("Base64 input must be a string")
        return embedder.embedding_from_base64(nifti_data)
    elif isinstance(nifti_data, bytes):
        return embedder.embedding_from_bytes(nifti_data)
    else:
        return embedder(nifti_data)


class ImagingEmbeddingMetadata(BaseModel):
    """Metadata for imaging embedding generation."""

    imaging_study_id: str
    modality: ModalityType
    embedding_dim: int
    generation_time_ms: float
    device: str
    provenance: DataProvenance = DataProvenance.AI_GENERATED
    model_version: str = "1.0"


class ImagingEmbeddingResult:
    """Result of imaging embedding generation."""

    def __init__(
        self,
        embedding: np.ndarray[Any, Any],
        imaging_study_id: str,
        modality: ModalityType,
        metadata: ImagingEmbeddingMetadata
    ):
        self.embedding = embedding
        self.imaging_study_id = imaging_study_id
        self.modality = modality
        self.metadata = metadata

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "embedding": self.embedding.tolist(),
            "imaging_study_id": self.imaging_study_id,
            "modality": self.modality.value,
            "metadata": self.metadata.dict(),
            "embedding_dim": len(self.embedding),
        }


__all__ = [
    "ImagingEmbeddingError",
    "CardiacImagingEmbedder",
    "get_imaging_embedder",
    "generate_cardiac_embedding",
    "ImagingEmbeddingMetadata",
    "ImagingEmbeddingResult",
]
