var gulp = require('gulp');
var babel = require('gulp-babel');
var mocha = require('gulp-mocha');
var del = require('del');
var nodeVersion = require('node-version');

gulp.task('clean', function() {
    return del('lib');
});

gulp.task(
    'build',
    gulp.series('clean', function() {
        return gulp
            .src('src/**/*.js')
            .pipe(babel())
            .pipe(gulp.dest('lib'));
    })
);

gulp.task(
    'test',
    gulp.series('build', function() {
        return gulp.src('test/**.js').pipe(
            mocha({
                ui: 'bdd',
                reporter: 'spec',
                timeout: typeof v8debug === 'undefined' ? 2000 : Infinity, // NOTE: disable timeouts in debug
            })
        );
    })
);
