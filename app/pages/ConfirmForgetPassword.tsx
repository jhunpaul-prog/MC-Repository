import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { auth } from '../Backend/firebase';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { ChangePasswordEmail } from '../utils/ChangePasswordEmail';

import {
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

const borderColor = '#800000';

const ConfirmForgetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get('oobCode');

  const [newPassword, setNewPassword] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);
  const [error, setError] = useState('');
  const [validCode, setValidCode] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setError('Missing action code.');
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setUserEmail(email);
        setValidCode(true);
      })
      .catch(() => {
        setError('Link Expired or Invalid. Please try again.');
      });
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!oobCode) {
      setError('Missing action code.');
      return;
    }

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      const userName = userEmail.split('@')[0];
      await ChangePasswordEmail(userEmail, newPassword, userName);
      setSuccessOpen(true); // show the styled success dialog
    } catch (catchErr: any) {
      const errMsg = catchErr.message || 'Failed to reset password.';
      setError(errMsg);
    }
  };

  return (
    <>
      <div className="relative flex items-center justify-center h-screen bg-cover bg-center" style={{ backgroundImage: "url('/assets/schoolPhoto1.png')" }}>
        <div className="w-full max-w-md bg-white border border-gray-300 rounded-xl p-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-red-900 text-center mb-4">New Password</h2>

          {validCode && (
            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                margin="normal"
                required
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor },
                    '&:hover fieldset': { borderColor },
                    '&.Mui-focused fieldset': { borderColor },
                  },
                  '& .MuiInputLabel-root': { color: borderColor },
                  '& .MuiInputLabel-root.Mui-focused': { color: borderColor },
                  input: { color: '#000000' },
                }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                sx={{
                  mt: 2,
                  backgroundColor: borderColor,
                  color: '#ffffff',
                  '&:hover': { backgroundColor: '#660000' },
                }}
              >
                Change Password
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* ✅ Styled Password Changed Modal */}
      <Dialog open={successOpen} onClose={() => { setSuccessOpen(false); navigate('/login'); }}>
        <DialogTitle>
          <div className="flex items-center justify-center flex-col text-center">
            <CheckCircleIcon sx={{ fontSize: 50, color: 'green' }} />
            <h3 className="text-xl font-bold mt-2 text-green-700">Password Changed!</h3>
            <p className="text-gray-700 text-sm mt-1">Your password has been changed successfully.</p>
          </div>
        </DialogTitle>
        <DialogActions sx={{ justifyContent: 'center', pb: 5}}>
          <Button
            onClick={() => navigate('/login')}
            sx={{
              backgroundColor: '#00695c',
              color: '#fff',
              px: 4,
              borderRadius: '10px',
              '&:hover': { backgroundColor: '#004d40' },
            }}
          >
            Back to Login Page
          </Button>
        </DialogActions>
      </Dialog>

      {/* ❌ Error Modal */}
      <Dialog open={!!error} onClose={() => setError('')}>
        <DialogTitle>
          <div className="flex items-center justify-center flex-col text-center">
            <ErrorIcon sx={{ fontSize: 50, color: '#d32f2f' }} />
            <h3 className="text-xl font-bold mt-2 text-red-700">Link Expired</h3>
            <p className="text-gray-700 text-sm mt-1">Return to login and request a new reset link.</p>
          </div>
        </DialogTitle>
        <DialogActions sx={{ justifyContent: 'center', pb: 5 }}>
          <Button
            onClick={() => {
              setError('');
              navigate('/login');
            }}
            sx={{
              backgroundColor: '#800000',
              color: '#fff',
              px: 4,
              borderRadius: '10px',
              '&:hover': { backgroundColor: '#5a0000' },
            }}
          >
            Back to Login Page
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConfirmForgetPassword;
