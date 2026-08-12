import cv2
import numpy as np

MOCK_LIVENESS = False
mp_face_mesh = None
face_mesh_model = None

try:
    import mediapipe as mp
    mp_face_mesh = mp.solutions.face_mesh
    # Load MediaPipe Face Mesh model
    face_mesh_model = mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    print("MediaPipe Face Mesh initialized successfully!")
    MOCK_LIVENESS = False
except Exception as e:
    print("\n" + "="*80)
    print("WARNING: MediaPipe failed to load. Liveness checks will run in simulated mode.")
    print(f"Error: {e}")
    print("="*80 + "\n")
    MOCK_LIVENESS = True

# Standard landmark indices for Eye Aspect Ratio (EAR)
LEFT_EYE_LANDMARKS = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_LANDMARKS = [33, 160, 158, 133, 153, 144]

# Mouth landmarks for Smile detection
MOUTH_CORNER_LEFT = 61
MOUTH_CORNER_RIGHT = 291
NOSE_TIP = 1

def get_landmark_points(landmarks, indices, img_w, img_h):
    points = []
    for idx in indices:
        lm = landmarks[idx]
        points.append((int(lm.x * img_w), int(lm.y * img_h)))
    return points

def calculate_ear(eye_points):
    """
    Computes Eye Aspect Ratio (EAR) using vertical and horizontal distances.
    """
    # vertical eye landmarks
    p2_minus_p6 = np.linalg.norm(np.array(eye_points[1]) - np.array(eye_points[5]))
    p3_minus_p5 = np.linalg.norm(np.array(eye_points[2]) - np.array(eye_points[4]))
    # horizontal eye landmark
    p1_minus_p4 = np.linalg.norm(np.array(eye_points[0]) - np.array(eye_points[3]))
    
    if p1_minus_p4 == 0:
        return 0.0
    return (p2_minus_p6 + p3_minus_p5) / (2.0 * p1_minus_p4)

def check_blink(cv_img):
    """
    Returns True if user eyes are closed (blink detected), indicating a blink occurred.
    """
    if MOCK_LIVENESS or face_mesh_model is None:
        return True
        
    try:
        h, w = cv_img.shape[:2]
        rgb_img = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
        results = face_mesh_model.process(rgb_img)
        
        if not results.multi_face_landmarks:
            return False
            
        landmarks = results.multi_face_landmarks[0].landmark
        
        left_eye_points = get_landmark_points(landmarks, LEFT_EYE_LANDMARKS, w, h)
        right_eye_points = get_landmark_points(landmarks, RIGHT_EYE_LANDMARKS, w, h)
        
        left_ear = calculate_ear(left_eye_points)
        right_ear = calculate_ear(right_eye_points)
        avg_ear = (left_ear + right_ear) / 2.0
        
        # Closed eye threshold is usually around 0.20 - 0.22
        return avg_ear < 0.21
    except Exception as e:
        print(f"Blink check error: {e}")
        return False

def check_head_turn(cv_img):
    """
    Returns 'left', 'right', or 'center' based on head turn estimation.
    Checks the ratio of distance from nose tip to left/right face boundaries.
    """
    if MOCK_LIVENESS or face_mesh_model is None:
        return 'center'
        
    try:
        h, w = cv_img.shape[:2]
        rgb_img = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
        results = face_mesh_model.process(rgb_img)
        
        if not results.multi_face_landmarks:
            return 'center'
            
        landmarks = results.multi_face_landmarks[0].landmark
        
        # Left, right edge landmarks and nose tip
        left_edge = landmarks[234].x * w
        right_edge = landmarks[454].x * w
        nose_x = landmarks[1].x * w
        
        dist_left = abs(nose_x - left_edge)
        dist_right = abs(right_edge - nose_x)
        
        total = dist_left + dist_right
        if total == 0:
            return 'center'
            
        ratio = dist_left / total
        
        if ratio < 0.38:
            return 'left'
        elif ratio > 0.62:
            return 'right'
        else:
            return 'center'
    except Exception as e:
        print(f"Head turn error: {e}")
        return 'center'

def check_smile(cv_img):
    """
    Returns True if user is smiling.
    """
    if MOCK_LIVENESS or face_mesh_model is None:
        return True
        
    try:
        h, w = cv_img.shape[:2]
        rgb_img = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
        results = face_mesh_model.process(rgb_img)
        
        if not results.multi_face_landmarks:
            return False
            
        landmarks = results.multi_face_landmarks[0].landmark
        
        mouth_l = np.array([landmarks[MOUTH_CORNER_LEFT].x * w, landmarks[MOUTH_CORNER_LEFT].y * h])
        mouth_r = np.array([landmarks[MOUTH_CORNER_RIGHT].x * w, landmarks[MOUTH_CORNER_RIGHT].y * h])
        
        mouth_width = np.linalg.norm(mouth_l - mouth_r)
        
        # Normalize relative to face width (distance between side edges)
        face_l = np.array([landmarks[234].x * w, landmarks[234].y * h])
        face_r = np.array([landmarks[454].x * w, landmarks[454].y * h])
        face_width = np.linalg.norm(face_l - face_r)
        
        if face_width == 0:
            return False
            
        ratio = mouth_width / face_width
        # Standard smile ratio threshold is > 0.35
        return ratio > 0.36
    except Exception as e:
        print(f"Smile check error: {e}")
        return False
