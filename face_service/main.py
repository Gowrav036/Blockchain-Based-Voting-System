import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.face import router as face_router

app = FastAPI(
    title="Biometric Face Verification API",
    description="Python FastAPI Service for ArcFace and MediaPipe Biometrics",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Node.js backend communicates locally
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(face_router)

@app.get("/")
def read_root():
    return {"message": "FastAPI Face Verification Service is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
