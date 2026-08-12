from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import numpy as np

from utils.image_processing import decode_base64_image
from services.face_recognition import generate_embedding, cosine_similarity, MOCK_BIOMETRICS
from services.liveness import check_blink, check_head_turn, check_smile

router = APIRouter()

# Schema models
class RegisterFaceRequest(BaseModel):
    voter_id: str
    images: List[str]  # 10 base64 strings

class VerifyFaceRequest(BaseModel):
    voter_id: str
    image: str  # Single live base64 capture
    stored_embedding: List[float]  # Stored embedding from MongoDB

class LivenessChallengeRequest(BaseModel):
    challenge: str  # 'blink', 'smile', 'left', 'right'
    image: str  # Live base64 capture to test against

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "mock_mode": MOCK_BIOMETRICS,
        "engine": "InsightFace (ArcFace)"
    }

@router.post("/register-face")
def register_face(request: RegisterFaceRequest):
    if len(request.images) != 10:
        raise HTTPException(status_code=400, detail="Precisely 10 webcam captures are required for registration")
        
    embeddings = []
    
    try:
        for i, img_b64 in enumerate(request.images):
            cv_img = decode_base64_image(img_b64)
            if cv_img is None:
                raise HTTPException(status_code=400, detail=f"Image {i+1} is corrupt or cannot be decoded")
                
            try:
                emb = generate_embedding(cv_img)
                embeddings.append(emb)
            except Exception as e:
                # Under non-mock mode, if a face is not detected in one of the registration images
                if not MOCK_BIOMETRICS:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Face could not be detected in frame {i+1}. Please align properly and try again."
                    )
                else:
                    # In mock mode, generate simulated embedding anyway
                    emb = generate_embedding(None)
                    embeddings.append(emb)
                    
        # Average the embeddings across all 10 frames
        averaged_embedding = np.mean(embeddings, axis=0).tolist()
        
        return {
            "success": True,
            "voter_id": request.voter_id,
            "embedding": averaged_embedding,
            "message": "Face registered successfully. 10 frames processed and averaged."
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Biometric registration failed: {str(e)}")

@router.post("/verify-face")
def verify_face(request: VerifyFaceRequest):
    cv_img = decode_base64_image(request.image)
    if cv_img is None:
        raise HTTPException(status_code=400, detail="Webcam frame is corrupt or cannot be decoded")
        
    try:
        try:
            live_embedding = generate_embedding(cv_img)
        except Exception as e:
            if not MOCK_BIOMETRICS:
                raise HTTPException(status_code=400, detail="Face not detected. Keep head steady and look straight.")
            else:
                live_embedding = generate_embedding(None)
                
        # Compare embeddings using cosine similarity
        if MOCK_BIOMETRICS:
            # Generate simulated verification score above match threshold
            similarity = float(np.random.uniform(0.81, 0.93))
        else:
            similarity = cosine_similarity(live_embedding, request.stored_embedding)
            
        threshold = 0.75
        matched = similarity >= threshold
        
        return {
            "matched": matched,
            "score": similarity,
            "threshold": threshold,
            "message": "Face verification successful" if matched else "Biometric signature mismatch. Verification rejected."
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Biometric verification failed: {str(e)}")

@router.post("/verify-liveness")
def verify_liveness(request: LivenessChallengeRequest):
    cv_img = decode_base64_image(request.image)
    if cv_img is None:
        raise HTTPException(status_code=400, detail="Webcam frame is corrupt or cannot be decoded")
        
    challenge = request.challenge.strip().lower()
    success = False
    
    if challenge == 'blink':
        success = check_blink(cv_img)
    elif challenge == 'smile':
        success = check_smile(cv_img)
    elif challenge == 'left':
        success = (check_head_turn(cv_img) == 'left')
    elif challenge == 'right':
        success = (check_head_turn(cv_img) == 'right')
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported liveness challenge: {challenge}")
        
    return {
        "success": success,
        "challenge": challenge,
        "message": f"Liveness challenge '{challenge}' {'passed' if success else 'failed'}"
    }
