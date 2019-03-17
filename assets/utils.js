// Logger
function logger(message, async) {
    if (async === true) {
        window.setTimeout(function() { 
            console.log(message);
        }, 0);
    } else {
        console.log(message);
    }
}

// String format
String.prototype.format = function () {
    var args = [].slice.call(arguments);
    return this.replace(/(\{\d+\})/g, function (a){
        return args[+(a.substr(1,a.length-2))||0];
    });
};

// Array diff
Array.prototype.diff = function(a) {
    return this.filter(function(i) {return a.indexOf(i) < 0;});
};

// Random int
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Handlebars: Join helper
Handlebars.registerHelper('join', function(items, block) {
    var delimiter = block.hash.delimiter || ", ", 
        start = start = block.hash.start || 0, 
        len = items ? items.length : 0,
        end = block.hash.end || len,
        out = "";

        if(end > len) end = len;

    if ('function' === typeof block) {
        for (i = start; i < end; i++) {
            if (i > start) 
                out += delimiter;
            if('string' === typeof items[i])
                out += items[i];
            else
                out += block(items[i]);
        }
        return out;
    } else { 
        return [].concat(items).slice(start, end).join(delimiter);
    }
});

// Handlebars: Uppercase helper
Handlebars.registerHelper('upper', function(str) {
  return str.toUpperCase();
});
