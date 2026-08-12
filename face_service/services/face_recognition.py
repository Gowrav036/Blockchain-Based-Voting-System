import numpy as np
from numpy import dot
from numpy.linalg import norm
import os

MOCK_BIOMETRICS = False
app_model = None

try:
    # Check if InsightFace Buffalo model directory exists locally
    model_dir = os.path.expanduser('~/.insightface/models/buffalo_l')
    
    if not os.path.exists(model_dir):
        print("\n" + "="*80)
        print("InsightFace buffalo_l models not found locally.")
        print("Starting in Biometric Simulation Mode for instant boot.")
        print("="*80 + "\n")
        MOCK_BIOMETRICS = True
    else:
        import insightface
        from insightface.app import FaceAnalysis
        
        # Initialize the InsightFace model using standard ArcFace
        app_model = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        app_model.prepare(ctx_id=0, det_size=(640, 640))
        print("InsightFace ArcFace models loaded successfully!")
        MOCK_BIOMETRICS = False
except Exception as e:
    print("\n" + "="*80)
    print("WARNING: InsightFace failed to load (or ONNX runtime failed).")
    print(f"Error: {e}")
    print("Enabling InsightFace Biometric Simulation Mode for cross-environment compatibility.")
    print("="*80 + "\n")
    MOCK_BIOMETRICS = True


def generate_embedding(cv_img):
    """
    Detects a face in the input OpenCV image and returns its 512-dimensional ArcFace embedding.
    """
    if MOCK_BIOMETRICS or app_model is None:
        # Return a simulated 512-dimensional normalized embedding
        mock_vector = np.random.randn(512)
        return (mock_vector / norm(mock_vector)).tolist()
    
    try:
        # Detect and analyze faces
        faces = app_model.get(cv_img)
        if not faces or len(faces) == 0:
            raise ValueError("No face detected in the image.")
        
        # Get embedding of the first detected face (512 float values)
        embedding = faces[0].normed_embedding
        return embedding.tolist()
    except Exception as e:
        print(f"Error generating embedding: {e}")
        raise e

def cosine_similarity(e1, e2):
    """
    Computes the cosine similarity between two 512-dimensional embeddings.
    """
    vec1 = np.array(e1)
    vec2 = np.array(e2)
    
    denom = norm(vec1) * norm(vec2)
    if denom == 0:
        return 0.0
    return float(dot(vec1, vec2) / denom)
