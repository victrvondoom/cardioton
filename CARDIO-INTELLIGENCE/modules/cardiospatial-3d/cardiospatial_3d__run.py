#!/usr/bin/env python3
"""
CARDIOSPATIAL-3D: Cardiovascular Risk Visualization & Multi-Vessel Stenosis Prediction
Launcher Script
"""
import os
import sys
import webbrowser
import uvicorn

def main():
    print("=======================================================================")
    print("  CARDIOSPATIAL-3D: Cardiovascular Risk Visualization & Prediction     ")
    print("  Multimodal AI Hackathon 2026 - Track A Prototype                     ")
    print("=======================================================================")
    
    # Check if models exist, if not train them
    models_path = os.path.join(os.path.dirname(__file__), "models", "cardio_models.joblib")
    if not os.path.exists(models_path):
        print("\nTrained models not detected. Running training pipeline...")
        import subprocess
        subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "models", "train_pipeline.py")], check=True)
        
    port = 8000
    host = "0.0.0.0"
    url = f"http://localhost:{port}"
    
    print(f"\nStarting CardioSpatial-3D server at: {url}")
    print("Opening web browser...")
    
    # Open browser automatically after short delay
    import threading, time
    def open_browser():
        time.sleep(1.5)
        try:
            webbrowser.open(url)
        except Exception:
            pass
            
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Run FastAPI
    uvicorn.run("backend.cardiospatial_3d__backend__app:app", host=host, port=port, reload=False, log_level="info")

if __name__ == "__main__":
    main()
