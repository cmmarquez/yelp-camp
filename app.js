const express = require("express"),
    app = express(),
    bodyParser = require("body-parser"),
    mongoose = require("mongoose"),
    methodOverride = require("method-override"),
    flash = require("connect-flash"),
    passport = require("passport"),
    LocalStrategy = require("passport-local"),
    User = require("./models/user");

app.locals.moment = require("moment");

const campgroundRoutes = require("./routes/campgrounds"),
    commentsRoutes = require("./routes/comments"),
    indexRoutes = require("./routes/index");

app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));
mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useFindAndModify: false });
app.use(methodOverride("_method"));
app.use(flash());

app.use(require("express-session")({
    resave: false,
    saveUninitialized: false,
    secret: process.env.ES_SECRET
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((request, response, next) => {
    response.locals.currentUser = request.user;
    response.locals.error = request.flash("error");
    response.locals.success = request.flash("success");
    next();
});

app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:id/comments", commentsRoutes);
app.use("/", indexRoutes);

app.listen(process.env.PORT, () => {
    console.log("The YelpCamp server has started!");
});