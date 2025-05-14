import React from "react";
import "./ConfirmationModal.css";

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  isAlert,
  requestType,
  requestMessage,
}) => {
  const handleConfirm = () => {
    onConfirm(true);
    onClose();
  };

  const handleCancel = () => {
    onConfirm(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{requestType}</h2>
        <p>{requestMessage}</p>
        <div className="modal-buttons">
          <button onClick={handleConfirm}>{isAlert ? "OK" : "Yes"}</button>
          {!isAlert && <button onClick={handleCancel}>No</button>}
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
