/** Error dengan status HTTP, ditangani errorHandler secara seragam */
class ApiError extends Error {
  constructor(status, message, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }

  static badRequest(message = 'Data tidak valid', errors = []) {
    return new ApiError(400, message, errors);
  }
  static unauthorized(message = 'Token tidak valid') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'Akses ditolak') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Data tidak ditemukan') {
    return new ApiError(404, message);
  }
  static conflict(message = 'Data sudah ada') {
    return new ApiError(409, message);
  }
}

module.exports = { ApiError };
