#!/usr/bin/env python3
"""
MediaPipe Holistic Processor (0.10.x API)
Extracts quantitative pose, body language, and facial metrics from video
"""

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import json
import sys
import os
import urllib.request
from pathlib import Path

class MediaPipeProcessor:
    def __init__(self):
        # Set up model directory
        self.model_dir = Path(__file__).parent / 'models'
        self.model_dir.mkdir(exist_ok=True)

        # Download models if not present
        self.pose_model = self._download_model(
            'pose_landmarker_heavy.task',
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task'
        )

        self.hand_model = self._download_model(
            'hand_landmarker.task',
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'
        )

        self.face_model = self._download_model(
            'face_landmarker.task',
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'
        )

        # Initialize landmarkers
        pose_options = vision.PoseLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=str(self.pose_model)),
            running_mode=vision.RunningMode.VIDEO,
            min_pose_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.pose_landmarker = vision.PoseLandmarker.create_from_options(pose_options)

        hand_options = vision.HandLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=str(self.hand_model)),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.hand_landmarker = vision.HandLandmarker.create_from_options(hand_options)

        face_options = vision.FaceLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=str(self.face_model)),
            running_mode=vision.RunningMode.VIDEO,
            min_face_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.face_landmarker = vision.FaceLandmarker.create_from_options(face_options)

    def _download_model(self, filename, url):
        """Download model file if it doesn't exist"""
        model_path = self.model_dir / filename

        if model_path.exists():
            print(f"Model already exists: {filename}", file=sys.stderr)
            return model_path

        print(f"Downloading {filename}...", file=sys.stderr)
        try:
            urllib.request.urlretrieve(url, model_path)
            print(f"Downloaded {filename}", file=sys.stderr)
        except Exception as e:
            print(f"Error downloading {filename}: {e}", file=sys.stderr)
            raise

        return model_path

    def calculate_angle(self, a, b, c):
        """Calculate angle between three points"""
        if a is None or b is None or c is None:
            return None

        radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - \
                  np.arctan2(a[1] - b[1], a[0] - b[0])
        angle = np.abs(radians * 180.0 / np.pi)

        if angle > 180.0:
            angle = 360 - angle

        return angle

    def get_landmark_coords(self, landmark):
        """Extract x, y coordinates from landmark"""
        if landmark:
            return [landmark.x, landmark.y]
        return None

    def analyze_pose(self, pose_result):
        """Analyze body pose and posture"""
        if not pose_result or not pose_result.pose_landmarks:
            return None

        landmarks = pose_result.pose_landmarks[0]

        # Extract key points (using MediaPipe pose landmark indices)
        left_shoulder = self.get_landmark_coords(landmarks[11])  # LEFT_SHOULDER
        right_shoulder = self.get_landmark_coords(landmarks[12])  # RIGHT_SHOULDER
        left_elbow = self.get_landmark_coords(landmarks[13])  # LEFT_ELBOW
        right_elbow = self.get_landmark_coords(landmarks[14])  # RIGHT_ELBOW
        left_wrist = self.get_landmark_coords(landmarks[15])  # LEFT_WRIST
        right_wrist = self.get_landmark_coords(landmarks[16])  # RIGHT_WRIST
        left_hip = self.get_landmark_coords(landmarks[23])  # LEFT_HIP
        right_hip = self.get_landmark_coords(landmarks[24])  # RIGHT_HIP
        nose = self.get_landmark_coords(landmarks[0])  # NOSE

        # Calculate torso midpoint
        if left_shoulder and right_shoulder and left_hip and right_hip:
            shoulder_mid = [(left_shoulder[0] + right_shoulder[0]) / 2,
                           (left_shoulder[1] + right_shoulder[1]) / 2]
            hip_mid = [(left_hip[0] + right_hip[0]) / 2,
                      (left_hip[1] + right_hip[1]) / 2]

            # Forward lean (angle of torso from vertical)
            torso_angle = np.arctan2(shoulder_mid[0] - hip_mid[0],
                                     hip_mid[1] - shoulder_mid[1]) * 180 / np.pi
            forward_lean = abs(torso_angle)
        else:
            forward_lean = None

        # Arms crossed detection
        arms_crossed = False
        if left_wrist and right_wrist and left_shoulder and right_shoulder:
            torso_center = (left_shoulder[0] + right_shoulder[0]) / 2
            left_wrist_crossed = left_wrist[0] > torso_center
            right_wrist_crossed = right_wrist[0] < torso_center
            arms_crossed = left_wrist_crossed and right_wrist_crossed

        # Open posture (shoulder width)
        shoulder_width = None
        if left_shoulder and right_shoulder:
            shoulder_width = np.linalg.norm(np.array(left_shoulder) - np.array(right_shoulder))

        # Body orientation
        body_orientation = None
        if left_shoulder and right_shoulder:
            body_orientation = np.arctan2(
                right_shoulder[1] - left_shoulder[1],
                right_shoulder[0] - left_shoulder[0]
            ) * 180 / np.pi

        return {
            'forward_lean_angle': float(forward_lean) if forward_lean is not None else None,
            'arms_crossed': bool(arms_crossed),
            'shoulder_width': float(shoulder_width) if shoulder_width is not None else None,
            'body_orientation': float(body_orientation) if body_orientation is not None else None,
            'open_posture': bool(shoulder_width > 0.15) if shoulder_width else None
        }

    def analyze_head_movement(self, face_result, prev_face_result):
        """Detect head movements like nodding"""
        if not face_result or not face_result.face_landmarks or \
           not prev_face_result or not prev_face_result.face_landmarks:
            return None

        # Get nose tip position (landmark 1)
        current_nose = face_result.face_landmarks[0][1]
        prev_nose = prev_face_result.face_landmarks[0][1]

        # Vertical movement (nodding)
        vertical_movement = current_nose.y - prev_nose.y

        return {
            'vertical_movement': float(vertical_movement),
            'is_nodding': bool(abs(vertical_movement) > 0.01)
        }

    def analyze_hands(self, hand_result):
        """Analyze hand gestures and positions"""
        hand_analysis = {
            'left_hand_visible': False,
            'right_hand_visible': False,
            'gesturing': False
        }

        if hand_result and hand_result.hand_landmarks:
            num_hands = len(hand_result.hand_landmarks)
            hand_analysis['left_hand_visible'] = num_hands > 0
            hand_analysis['right_hand_visible'] = num_hands > 1
            hand_analysis['gesturing'] = num_hands > 0

        return hand_analysis

    def process_video(self, video_path, sample_rate=1.0):
        """
        Process video and extract pose metrics

        Args:
            video_path: Path to video file
            sample_rate: Frames per second to process (default 1.0 fps)

        Returns:
            List of frame analyses with timestamps
        """
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_interval = int(fps / sample_rate)

        results = []
        frame_count = 0
        prev_face_result = None

        print(f"Processing video at {sample_rate} fps (every {frame_interval} frames)...", file=sys.stderr)

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # Process only at specified sample rate
            if frame_count % frame_interval != 0:
                frame_count += 1
                continue

            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Create MediaPipe Image
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

            # Calculate timestamp in milliseconds
            timestamp_ms = int((frame_count / fps) * 1000)

            # Process with MediaPipe
            pose_result = self.pose_landmarker.detect_for_video(mp_image, timestamp_ms)
            hand_result = self.hand_landmarker.detect_for_video(mp_image, timestamp_ms)
            face_result = self.face_landmarker.detect_for_video(mp_image, timestamp_ms)

            # Analyze pose
            pose_analysis = self.analyze_pose(pose_result)

            # Analyze head movement
            head_analysis = self.analyze_head_movement(face_result, prev_face_result)

            # Analyze hands
            hand_analysis = self.analyze_hands(hand_result)

            # Store results
            frame_result = {
                'timestamp': float(frame_count / fps),
                'frame_number': frame_count,
                'pose': pose_analysis,
                'head': head_analysis,
                'hands': hand_analysis,
                'has_person_detected': pose_result.pose_landmarks is not None and len(pose_result.pose_landmarks) > 0
            }

            results.append(frame_result)

            # Update previous face result
            prev_face_result = face_result

            frame_count += 1

            if frame_count % 30 == 0:
                print(f"Processed frame {frame_count} ({frame_count/fps:.1f}s)", file=sys.stderr)

        cap.release()

        print(f"Completed processing {len(results)} frames", file=sys.stderr)

        return results

def main():
    if len(sys.argv) < 2:
        print("Usage: python mediapipe_processor.py <video_path> [sample_rate]", file=sys.stderr)
        sys.exit(1)

    video_path = sys.argv[1]
    sample_rate = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0

    if not Path(video_path).exists():
        print(f"Error: Video file not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    processor = MediaPipeProcessor()
    results = processor.process_video(video_path, sample_rate)

    # Output JSON to stdout
    print(json.dumps({
        'success': True,
        'video_path': video_path,
        'sample_rate': sample_rate,
        'frames_processed': len(results),
        'results': results
    }, indent=2))

if __name__ == '__main__':
    main()
