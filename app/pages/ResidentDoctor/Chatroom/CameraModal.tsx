import React, { useRef, useEffect, useState } from "react";

const CameraModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}> = ({ open, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Start video stream from camera
  useEffect(() => {
    if (videoRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } }) // Use environment camera (rear)
        .then((stream) => {
          videoRef.current!.srcObject = stream;
        })
        .catch((err) => console.error("Error accessing camera", err));
    }
  }, []);

  // Capture Image
  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg");
      setImageUrl(image);
      const imageFile = dataURLToFile(image);
      onCapture(imageFile); // Send the captured image
    }
  };

  // Convert data URL to file
  const dataURLToFile = (dataURL: string) => {
    const arr = dataURL.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new File([u8arr], "captured_image.jpg", { type: mime });
  };

  return (
    open && (
      <div className="camera-modal">
        <div className="camera-container">
          <video ref={videoRef} autoPlay playsInline></video>
        </div>
        <div className="controls">
          <button onClick={captureImage} className="capture-button">
            Capture
          </button>
          <button onClick={onClose} className="close-button">
            Close
          </button>
        </div>
        {imageUrl && (
          <img src={imageUrl} alt="Captured" className="captured-image" />
        )}
      </div>
    )
  );
};

export default CameraModal;
