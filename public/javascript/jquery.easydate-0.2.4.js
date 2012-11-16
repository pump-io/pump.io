(function($)
{
    /*
     * jQuery EasyDate 0.2.4 ($Rev: 54 $)
     * Copyright (c) 2009 Parsha Pourkhomami (parshap@gmail.com)
     * Licensed under the MIT license.
     */
    
    $.easydate = { };
    $.easydate.locales = { };
    $.easydate.locales.enUS = {
        "future_format": "%s %t",
        "past_format": "%t %s",
        "second": "second",
        "seconds": "seconds",
        "minute": "minute",
        "minutes": "minutes",
        "hour": "hour",
        "hours": "hours",
        "day": "day",
        "days": "days",
        "week": "week",
        "weeks": "weeks",
        "month": "month",
        "months": "months",
        "year": "year",
        "years": "years",
        "yesterday": "yesterday",
        "tomorrow": "tomorrow",
        "now": "just now",
        "ago": "ago",
        "in": "in"
    };
    
    var defaults = {
        live: true,
        set_title: true,
        format_future: true,
        format_past: true,
        units: [
            { name: "now", limit: 5 },
            { name: "second", limit: 60, in_seconds: 1 },
            { name: "minute", limit: 3600, in_seconds: 60 },
            { name: "hour", limit: 86400, in_seconds: 3600  },
            { name: "yesterday", limit: 172800, past_only: true },
            { name: "tomorrow", limit: 172800, future_only: true },
            { name: "day", limit: 604800, in_seconds: 86400 },
            { name: "week", limit: 2629743, in_seconds: 604800  },
            { name: "month", limit: 31556926, in_seconds: 2629743 },
            { name: "year", limit: Infinity, in_seconds: 31556926 }
        ],
        uneasy_format: function(date)
        {
            return date.toLocaleDateString();
        },
        locale: $.easydate.locales.enUS
    };
    
    // Difference (in milliseconds) between the local system time and the time
    // that should be used as "now". This is set by using set_now.
    var now_diff = 0;
    
    // A mapping of unique element IDs of elements that are waiting to be
    // updated to the ID of the timeout returned by setTimeOut.
    var updates = {};
    
    // A la updates, but contains element IDs for elements that are paused.
    var paused_updates = {};
    
    // A mapping of unique element IDs to the jQuery DOM elements it
    // represents.
    var elements = {};
    
    function __(str, value, settings)
    {
        if(!isNaN(value) && value != 1)
            str = str + "s";
        return settings.locale[str] || str;
    }
    
    // Pauses live updates of elements matching the given selector. If the
    // selector argument is omitted then all updating will be paused.
    var pause = $.easydate.pause = function(selector)
    {
        var p = function(element_id)
        {
            clearTimeout(updates[element_id]);
            delete updates[element_id];
            paused_updates[element_id] = true;
        };
        
        if(!selector)
        {
            for(var element_id in updates)
                p(element_id)
        }
        else
        {
            $(selector).each(function()
            {
                var element_id = jQuery.data(this);
                if(!isNaN(updates[element_id]))
                    p(element_id);
            });
        }
    };
    
    // Pauses updates on paused elements matching the given selector. If no
    // selector is provided, all updates will be resumed.
    var resume = $.easydate.resume = function(selector)
    {
        var r = function(element_id)
        {
            delete paused_updates[element_id];
            update_time(elements[element_id]);
        };
        
        if(!selector)
        {
            for(var element_id in paused_updates)
                r(element_id);
        }
        else
        {
            $(selector).each(function()
            {
                var element_id = jQuery.data(this);
                if(!isNaN(paused_updates[element_id]))
                    r(element_id);
            });
        }
    };
    
    // Makes all future time calculations relative to the given date argument
    // instead of the system clock. The date argument can be a JavaScript Date
    // object or a RFC 1123 valid timestamp string. This is useful for
    // synchronizing the user's clock with a server-side clock.
    var set_now = $.easydate.set_now = function(date)
    {
        var time;
        if(date instanceof Date)
            time = date.getTime();
        else
            time = Date.parse(date);
        
        if(isNaN(time))
            return;
            
        now_diff = time - (new Date()).getTime();
        
        // Re-adjust any previously formatted dates.
        for(var element_id in elements)
        {
            if(!isNaN[updates[element_id]])
                clearTimeout(updates[element_id]);
            update_time(elements[element_id]);
        }
    };
    
    var get_now = $.easydate.get_now = function()
    {
        var now = new Date();
        now.setTime(now.getTime() + now_diff);
        return now;
    };
    
    // Formats a Date object to a human-readable localized string.
    var format_date = $.easydate.format_date = function(date, options)
    {
        var settings = $.extend({}, defaults, options);
        
        var diff = ((get_now().getTime() - date.getTime()) / 1000);
        var diff_abs = Math.abs(diff);
        
        if(isNaN(diff))
            return;
        
        // Return if we shouldn't format this date because it is in the past
        // or future and our setting does not allow it.
        if((!settings.format_future && diff < 0) ||
            (!settings.format_past && diff > 0))
            return;
        
        for(var i in settings.units)
        {
            var unit = settings.units[i];
            
            // Skip this unit if it's for past dates only and this is a future
            // date, or if it's for future dates only and this is a past date.
            if((unit.past_only && diff < 0) || (unit.future_only && diff > 0))
                continue;
            
            if(diff_abs < unit.limit)
            {
                // Case for units that are not really measurement units - e.g.,
                // "yesterday" or "now".
                if(isNaN(unit.in_seconds))
                    return __(unit.name, NaN, settings);
                
                var val = diff_abs / unit.in_seconds;
                val = Math.round(val);
                var format_string;
                if(diff < 0)
                    format_string = __("future_format", NaN, settings)
                        .replace("%s", __("in", NaN, settings))
                else
                    format_string = __("past_format", NaN, settings)
                        .replace("%s", __("ago", NaN, settings))
                return format_string
                    .replace("%t", val + " " + __(unit.name, val, settings));
            }
        }
        
        // The date does not fall into any units' limits - use uneasy format.
        return settings.uneasy_format(date);
    }
    
    // Returns how long (in milliseconds) the timout until the next update for
    // the given date should be.
    function get_timeout_delay(date, settings)
    {
        var now = get_now();
        var diff = ((now.getTime() - date.getTime()) / 1000);
        var diff_abs = Math.abs(diff);
        
        if(isNaN(diff))
            return;
        
        var last_limit = 0;
        for(var i in settings.units)
        {
            var unit = settings.units[i];
            
            // Skip this unit if it's for past dates only and this is a future
            // date, or if it's for future dates only and this is a past date.
            if((unit.past_only && diff < 0) || (unit.future_only && diff > 0))
                continue;
            
            if(diff_abs < unit.limit)
            {
                // @todo: check edge cases (diff == 0)
                if(isNaN(unit.in_seconds))
                {
                    // This is not a real unit of time, so only update once we
                    // pass the limit of this unit.
                    if(diff < 0)
                        return (last_limit - diff_abs) * 1000 + 100;
                    else
                        return (unit.limit - diff_abs) * 1000 + 100;
                }
                else
                {
                    // Real unit of time - update every tick of this time unit.
                    if(diff < 0)
                        return (diff_abs % unit.in_seconds) * 1000 + 100
                    else
                        return (unit.in_seconds - (diff_abs % unit.in_seconds)) *
                            1000 + 100
                }
            }
            last_limit = unit.limit;
        }
        
        // Date is out of range of all units' limits. If this is a future date,
        // update once the date comes in range of a future unit.
        if(diff < 0)
        {
            for(var i = settings.units.length - 1; i >= 0; i--)
            {
                var unit = settings.units[i];
                
                if(unit.past_only)
                    continue;
                
                return (unit.limit - diff_abs) * 1000 + 100
            }
        }
    }
    
    // Returns a date object for the date represented by the given DOM element
    // from the following sources (in order):
    //     1) element.data("easydate.date") (in case we previously cached it)
    //     2) DOM element's title (if it is a valid RFC 1123 timestamp)
    //     3) DOM element's innerHTML (if it is a valid RFC 1123 timestamp)
    function get_date(element, settings)
    {
        var date = element.data("easydate.date");
        
        if(isNaN(date))
        {
            var timestamp;
            var time = Date.parse(timestamp = element.attr("title")) ||
                       Date.parse(timestamp = element.html());
            if(!isNaN(time))
            {
                date = new Date();
                date.setTime(time);
                element.data("easydate.date", date);
                if(settings.set_title && !element.attr("title"))
                    element.attr("title", timestamp);
            }
        }
        
        return date;
    }
    
    // Updates the given element's innerHTML based on the time it represents.
    function update_time(element)
    {
        var settings = element.data("easydate.settings");
        
        var element_id = $.data(element[0]);
        elements[element_id] = element;
        delete updates[element_id];
        
        var date = get_date(element, settings);
        
        if(isNaN(date))
            return;
            
        element.html(format_date(date, settings));
        
        if(settings.live)
        {
            var timeout = get_timeout_delay(date, settings);
            if(!isNaN(timeout))
            {
                if(timeout > 2147483647)
                    timeout = 2147483647; // max Firefox timeout delay
                
                var id = setTimeout(
                    function() { update_time(element); },
                    Math.round(timeout)
                );
                updates[element_id] = id;
            }
        }
    }
    
    $.fn.easydate = function(options)
    {
        var settings = $.extend({}, defaults, options);
        this.data("easydate.settings", settings);
        
        // Clear any cached dates in case the timestamp has been updated since
        // the last easydate() call on any of these elements.
        this.removeData("easydate.date");
        
        this.each(function()
        {
            // Make sure that we aren't updating the element multiple times in
            // case easydate() was called on the same element more than once.
            var element_id = $.data(this);
            if(!isNaN(updates[element_id]))
            {
                clearTimeout(updates[element_id]);
                delete updates[element_id];
            }
            
            update_time($(this));
        });
    };
    
})(jQuery);