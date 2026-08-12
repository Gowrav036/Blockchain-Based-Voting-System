import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image

def decode_base64_image(base64_str):
    """
    Decodes a base64 encoded image string to an OpenCV BGR image.
    """
    try:
        if "," in base64_str:
            # Strip data:image/jpeg;base64, header
            base64_str = base64_str.split(",")[1]
        
        img_bytes = base64.b64decode(base64_str)
        img_np = np.frombuffer(img_bytes, dtype=np.uint8)
        img_bgr = cv2.imdecode(img_np, cv2.IMREAD_COLOR)
        return img_bgr
    except Exception as e:
        print(f"Error decoding base64 image: {e}")
        return None

def align_face(image):
    """
    Applies standard alignment / resizing.
    Resizes input face image to standard 112x112 size required by ArcFace model.
    """
    if image is None:
        return None
    try:
        # Standard size for ArcFace is 112x112
        h, w = image.shape[:2]
        if h != 112 or w != 112:
            aligned = cv2.resize(image, (112, 112))
            return aligned
        return image
    except Exception as e:
        print(f"Error aligning face: {e}")
        return image
