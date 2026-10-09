const { z } = require('../../utils/zodHelpers');

exports.loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

exports.changePasswordSchema = z.object({
  old_password: z.string().min(1, 'Password lama wajib diisi'),
  new_password: z.string().min(6, 'Password minimal 6 karakter'),
});

exports.refreshSchema = z.object({
  token: z.string().min(1),
});
