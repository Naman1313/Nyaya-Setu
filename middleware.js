export const isloggedin = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "you must be logged in");
    return res.redirect("/login");
  }
  next();
};

export const saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
    delete req.session.redirectUrl;
  }
  next();
};

export const isPolice = (req, res, next) => {
  if (req.user?.role?.toLowerCase() === 'police') return next();
  req.flash('error', 'Restricted: Police only');
  return res.redirect('/dashboard');
};

export const isJudge = (req, res, next) => {
  if (req.user?.role?.toLowerCase() === 'judge') return next();
  req.flash('error', 'Restricted: Judges only');
  return res.redirect('/dashboard');
};