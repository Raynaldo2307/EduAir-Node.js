const authService = require('./authService');

exports.login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    return res.status(200).json(result);
  } catch (err) { next(err); }
};

exports.register = async (req, res, next) => {
  try {
    const user = await authService.register(req.user.schoolId, req.body);
    return res.status(201).json({ message: 'User registered successfully', user });
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    return res.status(200).json({ user });
  } catch (err) { next(err); }
};

exports.updateMe = async (req, res, next) => {
  try {
    const result = await authService.updateMe(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (err) { next(err); }
};
