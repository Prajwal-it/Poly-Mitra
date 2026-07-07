const mongoose = require('mongoose')
const cutoffSchema = new mongoose.Schema({
    year: {
        type: Number,
        required: true
    },
    round: {
        type: Number,
        required: true
    },
    collegeCode: {
        type: String,
        required: true
    },

    collegeName: {
        type: String,
        required: true
    },

    branchCode: {
        type: String,
        required: true
    },

    branchName: {
        type: String,
        required: true
    },

    category: {
        type: String,
        required: true
    },

    rank: Number,

    percentage: Number
});

module.exports = mongoose.model(
    "cutoff",
    cutoffSchema
);