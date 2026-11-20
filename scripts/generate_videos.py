#!/usr/bin/env python3
"""
AERIVA AI — Trainer Exercise Video Generator
=============================================
Generates short looping exercise clips from trainer-character.jpg
using an image-to-video API (Veo, Runway Gen-3, or Kling).

Usage:
    export AERIVA_VIDEO_API_KEY="your-api-key"
    export AERIVA_VIDEO_PROVIDER="runway"  # or "veo" or "kling"
    python scripts/generate_videos.py

The script reads the manifest at frontend/videos/manifest.json,
generates one 6-10s looping clip per exercise, and saves them to frontend/videos/.
"""

import json
import os
import sys
import time
from pathlib import Path

# Configuration
API_KEY = os.environ.get("AERIVA_VIDEO_API_KEY", "")
PROVIDER = os.environ.get("AERIVA_VIDEO_PROVIDER", "runway").lower()  # runway | veo | kling
TRAINER_IMAGE = Path(__file__).parent.parent / "frontend" / "trainer-character.jpg"
MANIFEST_PATH = Path(__file__).parent.parent / "frontend" / "videos" / "manifest.json"
OUTPUT_DIR = Path(__file__).parent.parent / "frontend" / "videos"

# Prompt templates per exercise
EXERCISE_PROMPTS = {
    "pushup": "A muscular athletic trainer performing incline push-ups with perfect form, side view, lowering chest to 90 degrees then pressing up explosively, studio gym background with clean lighting, steady camera, seamless loop",
    "squat": "A muscular athletic trainer performing bodyweight squats to overhead reach with proper form, front-side angle, descending to parallel thighs then extending arms overhead, clean gym studio background, steady camera, seamless loop",
    "plank": "A muscular athletic trainer holding a perfect plank position with core engaged, side view showing straight line from head to heels, slight breathing movement, clean gym studio background, steady camera, seamless loop",
    "jumping_jacks": "A muscular athletic trainer performing jumping jacks with full arm extension and proper landing form, front view, rhythmic movement, clean gym studio background, steady camera, seamless loop",
    "cat_cow": "A muscular athletic trainer performing cat-cow spinal flow on a yoga mat, side view, alternating between arched and rounded spine positions, slow controlled movement, clean studio background, steady camera, seamless loop",
    "glute_bridge": "A muscular athletic trainer performing glute bridges on a mat, side view, driving hips upward and squeezing glutes at top, controlled lowering, clean gym studio background, steady camera, seamless loop",
    "childs_pose": "A muscular athletic trainer in child's pose on a yoga mat, slight angle from above, gentle breathing movement, arms extended forward with forehead on mat, serene clean studio background, steady camera, seamless loop",
    "surya_namaskar": "A muscular athletic trainer performing sun salutation yoga flow, side view, flowing through prayer pose to forward fold to plank to cobra to downward dog, clean bright studio, steady camera, seamless loop",
    "warmup": "A muscular athletic trainer performing brisk warmup with arm swings and torso rotations, front view, dynamic controlled movements, clean gym studio background, steady camera, seamless loop",
    "walk_jog": "A muscular athletic trainer doing interval jogging in place alternating with brisk walking, front-side view, light and controlled foot strikes, clean gym studio background, steady camera, seamless loop",
    "stretching": "A muscular athletic trainer performing full body stretches with overhead reach and side bends, front view, slow controlled movements with deep breathing, clean gym studio background, steady camera, seamless loop",
}


def load_manifest():
    """Load the video manifest."""
    with open(MANIFEST_PATH) as f:
        return json.load(f)


def generate_video_runway(exercise_key: str, prompt: str, output_path: Path) -> bool:
    """Generate a video using Runway Gen-3 API."""
    try:
        import requests

        print(f"  [Runway] Generating video for '{exercise_key}'...")
        # Runway Gen-3 Alpha Turbo API
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        }

        # Read trainer image as base64
        import base64
        with open(TRAINER_IMAGE, "rb") as img_file:
            img_b64 = base64.b64encode(img_file.read()).decode()

        payload = {
            "promptImage": f"data:image/jpeg;base64,{img_b64}",
            "promptText": prompt,
            "model": "gen3a_turbo",
            "duration": 5,  # 5 or 10 seconds
            "ratio": "16:9",
            "watermark": False,
        }

        resp = requests.post(
            "https://api.dev.runwayml.com/v1/image_to_video",
            headers=headers,
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        task_id = resp.json().get("id")

        # Poll for completion
        for _ in range(120):  # up to 10 minutes
            time.sleep(5)
            status_resp = requests.get(
                f"https://api.dev.runwayml.com/v1/tasks/{task_id}",
                headers=headers,
                timeout=15,
            )
            status_data = status_resp.json()
            if status_data.get("status") == "SUCCEEDED":
                video_url = status_data.get("output", [None])[0]
                if video_url:
                    video_resp = requests.get(video_url, timeout=60)
                    output_path.write_bytes(video_resp.content)
                    print(f"  ✓ Saved: {output_path}")
                    return True
            elif status_data.get("status") == "FAILED":
                print(f"  ✗ Failed: {status_data.get('failure', 'Unknown error')}")
                return False

        print(f"  ✗ Timeout waiting for video generation")
        return False

    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def generate_video_veo(exercise_key: str, prompt: str, output_path: Path) -> bool:
    """Generate a video using Google Veo API."""
    try:
        import requests

        print(f"  [Veo] Generating video for '{exercise_key}'...")
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        }

        import base64
        with open(TRAINER_IMAGE, "rb") as img_file:
            img_b64 = base64.b64encode(img_file.read()).decode()

        payload = {
            "model": "veo-2.0-generate-001",
            "input": {
                "image": {"bytesBase64": img_b64, "mimeType": "image/jpeg"},
                "text": prompt,
            },
            "config": {
                "durationSeconds": 8,
                "aspectRatio": "16:9",
                "numberOfVideos": 1,
            },
        }

        resp = requests.post(
            "https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning",
            headers=headers,
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        operation_name = resp.json().get("name")

        for _ in range(120):
            time.sleep(5)
            status_resp = requests.get(
                f"https://generativelanguage.googleapis.com/v1beta/{operation_name}",
                headers=headers,
                timeout=15,
            )
            status_data = status_resp.json()
            if status_data.get("done"):
                videos = status_data.get("response", {}).get("videos", [])
                if videos:
                    video_bytes = bytes.fromhex(videos[0].get("bytesBase64", ""))
                    output_path.write_bytes(video_bytes)
                    print(f"  ✓ Saved: {output_path}")
                    return True

        return False

    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def generate_video_kling(exercise_key: str, prompt: str, output_path: Path) -> bool:
    """Generate a video using Kling API."""
    print(f"  [Kling] Generating video for '{exercise_key}'... (placeholder)")
    print(f"  ✗ Kling API integration not yet implemented. Use 'runway' or 'veo'.")
    return False


def main():
    if not API_KEY:
        print("=" * 60)
        print("AERIVA AI Video Generator")
        print("=" * 60)
        print()
        print("⚠ No API key found. Set AERIVA_VIDEO_API_KEY environment variable.")
        print()
        print("Example:")
        print('  export AERIVA_VIDEO_API_KEY="your-key-here"')
        print('  export AERIVA_VIDEO_PROVIDER="runway"  # or veo or kling')
        print("  python scripts/generate_videos.py")
        print()
        print("Without an API key, the app uses the existing canvas athlete")
        print("as fallback for all exercises.")
        sys.exit(1)

    if not TRAINER_IMAGE.exists():
        print(f"✗ Trainer image not found: {TRAINER_IMAGE}")
        sys.exit(1)

    manifest = load_manifest()
    exercises = manifest.get("exercises", {})
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    generators = {
        "runway": generate_video_runway,
        "veo": generate_video_veo,
        "kling": generate_video_kling,
    }

    generator = generators.get(PROVIDER)
    if not generator:
        print(f"✗ Unknown provider: {PROVIDER}. Use 'runway', 'veo', or 'kling'.")
        sys.exit(1)

    print(f"Provider: {PROVIDER.upper()}")
    print(f"Trainer image: {TRAINER_IMAGE}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Exercises: {len(exercises)}")
    print()

    success = 0
    failed = 0
    for key, info in exercises.items():
        prompt = EXERCISE_PROMPTS.get(key, f"Athletic trainer performing {info['title']} with proper form, studio background, steady camera, seamless loop")
        output_file = OUTPUT_DIR / f"{key}.mp4"

        if output_file.exists():
            print(f"  ⏭ Skipping {key} (already exists)")
            success += 1
            continue

        ok = generator(key, prompt, output_file)
        if ok:
            success += 1
        else:
            failed += 1

    print()
    print(f"Done: {success} generated, {failed} failed")


if __name__ == "__main__":
    main()
