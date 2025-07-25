import React, { useState } from 'react';
import { auth, db } from '../Backend/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { ref, query, orderByChild, equalTo, get } from 'firebase/database';
import {
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';


const borderColor = '#800000'; // Maroon color

const ForgetPassword: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const userQuery = query(
        ref(db, 'users'),
        orderByChild('email'),
        equalTo(email)
      );
      const userSnap = await get(userQuery);
      if (!userSnap.exists()) {
        setError('Email not registered in our system.');
        return;
      }

      await sendPasswordResetEmail(auth, email, {
        handleCodeInApp: true,
        url: `${window.location.origin}/reset-password`,
      });
      setMessage('✔️ Password Reset Email Sent!\nCheck your inbox and follow the instructions.');
    } catch (catchErr: unknown) {
      const errMsg = catchErr instanceof Error ? catchErr.message : 'An error occurred';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="relative flex items-center justify-center h-screen bg-cover bg-center"
        style={{ backgroundImage: "url('/assets/schoolPhoto1.png')" }}
      >
        <div className="w-full max-w-md bg-white border border-gray-300 rounded-xl p-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-red-900 text-center mb-4">Forgot Password</h2>
          <p className="text-center text-sm text-gray-700 mb-4">
            Enter the email address you used to register your account in the <strong>SWUMED Repository System</strong>. We’ll send you an email with instructions to reset your password.
          </p>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Registered Email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
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
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : null}
              sx={{
                mt: 2,
                backgroundColor: borderColor,
                color: '#ffffff',
                '&:hover': { backgroundColor: '#660000' },
              }}
            >
              {loading ? 'Verifying…' : ' Send Reset Link'}
            </Button>
            <Button
              fullWidth
              variant="text"
              sx={{ mt: 1, color: borderColor }}
              onClick={() => window.location.href = '/login'}
            >
               Back to Sign In
            </Button>
          </form>
        </div>
      </div>

{/* Styled Success Modal */}
<Dialog open={!!message} onClose={() => setMessage('')}>
  <DialogTitle>
    <div className="flex items-center justify-center flex-col text-center">
      <CheckCircleIcon sx={{ fontSize: 50, color: 'green' }} />
      <h3 className="text-xl font-bold mt-2 text-green-700">Reset Link Sent</h3>
      <p className="text-gray-700 text-sm mt-1">Password Reset Email Sent!{"\n"}Check your inbox and follow the instructions.</p>
    </div>
  </DialogTitle>
  <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
    <Button
      onClick={() => setMessage('')}
      sx={{
        color: borderColor,
        textTransform: 'none',
        fontWeight: 'bold',
      }}
      autoFocus
    >
      OK
    </Button>
  </DialogActions>
</Dialog>
      {/* Error Modal */}
      <Dialog open={!!error} onClose={() => setError('')}>
        <DialogTitle sx={{ color: 'red' }}>❌ Error</DialogTitle>
        <DialogContent>
          <DialogContentText className="text-gray-800 text-center">
            {error}
          </DialogContentText>
        </DialogContent>
        <DialogActions className="justify-center">
          <Button onClick={() => setError('')} sx={{ color: borderColor }} autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ForgetPassword;
