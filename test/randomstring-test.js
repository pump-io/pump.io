var assert = require('assert'),
    vows = require('vows');

vows.describe('randomstring module interface').addBatch({
    'When we require the randomstring module': {
        topic: function() { 
            return require('../lib/randomstring');
        },
        'we get a module back': function(rs) {
            assert.ok(rs);
        },
        'we can get the randomString function': {
            topic: function(rs) {
                return rs.randomString;
            },
            'which is a function': function (randomString) {
                assert.isFunction(randomString);
            },
            'we can get a random string': {
                topic: function(rs, randomString) {
                    randomString(16, this.callback);
                },
                'without an error': function(err, value) {
                    assert.ifError(err);
                },
                'with a string return value': function(err, value) {
                    assert.isString(value);
                },
                'with only URL-safe characters': function(err, value) {
                    assert.match(value, /^[A-Za-z0-9\-_]+$/);
                }
            }
        }
    }
}).export(module);

