/**
 * Created by harokku on 23/03/2017.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ShiftSchema = new Schema({
    badge: String,
    entertime: Date,
    exittime: Date
});

module.exports = mongoose.model('Shift', ShiftSchema);
