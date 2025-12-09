"""
Lightweight Hugging Face Inference API client with retry/backoff.

Uses environment variable HUGGINGFACE_API_TOKEN if present.
"""

from __future__ import annotations

import os
import time
import requests
from typing import Dict, Any


HF_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN")
HF_BASE_URL = "https://api-inference.huggingface.co/models"


def hf_infer(
    model: str,
    payload: Dict[str, Any],
    *,
    timeout: int = 60,
    retries: int = 2,
    backoff_seconds: int = 3,
) -> Any:
    """
    Call HF Inference API with simple retries on timeout/429.
    """
    headers = {"Content-Type": "application/json"}
    if HF_TOKEN:
        headers["Authorization"] = f"Bearer {HF_TOKEN}"

    last_err = None
    url = f"{HF_BASE_URL}/{model}"

    for attempt in range(retries + 1):
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
            if resp.status_code == 429:
                last_err = Exception("HF 429 rate limit")
            else:
                resp.raise_for_status()
                return resp.json()
        except requests.exceptions.Timeout as e:
            last_err = e
        except Exception as e:
            last_err = e
            # On final attempt, raise immediately for non-429/timeouts
            if attempt == retries:
                raise

        if attempt < retries:
            time.sleep(backoff_seconds)

    if last_err:
        raise last_err
    raise RuntimeError("HF inference failed without specific error")
