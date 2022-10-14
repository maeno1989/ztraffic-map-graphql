var height = $(window).offsetHeight,
    width = $(window).offsetWidth,
    //json = 'https://clients.connect.etherfax.net/Data/WarMapData',
	json = 'data/PewPewDataState7.txt',
    focus = true,
    plural = true,
    jsonData = [],
    interval = 1000,
    timer_min = getQueryVariable('timer_min'),
    timer_max = getQueryVariable('timer_max'),
    max_display = getQueryVariable('max_display'),
    impact_radius = getQueryVariable('impact_radius'),
    magnitude = getQueryVariable('magnitude'),
    arc_sharpness = getQueryVariable('arc_sharpness'),
    send_ratio = getQueryVariable('send_ratio');
    stroke_width = 1,
    fax_color = '#29CAFE',
    fax_count = 0,
    page_count = 0,
    page_volume = 0,
    page_array = 0,
    update_count = null,
    current_location = null,
    sen_color = '#60FE29',
    sen_count = 0,
    sen_doc_color = '#C729FE',
    sen_doc_count = 0,
    senx_color = '#FE5D29',
    senx_count = 0,
    top_location = [],
    top_location_list = document.getElementById('top-list');
    
// canvas grid background
var canvas = document.getElementById('grid');
var context = canvas.getContext('2d');
context.globalCompositeOperation = "lighter";

// set default variables if not defined in URL
if (!timer_min) {
    timer_min = 100;
    console.log('use default min ' + timer_min)
}
if (!timer_max) {
    timer_max = 200;
    console.log('use default max ' + timer_max)
}
if (!max_display) {
    max_display = 15;
    console.log('use default display count ' + max_display)
}
if (!impact_radius) {
    impact_radius = 2;
    console.log('use default radius ' + impact_radius)
}
if (!magnitude) {
    magnitude = 3;
    console.log('use default magnitude ' + magnitude)
}
if (!arc_sharpness) {
    arc_sharpness = 1;
    console.log('use default arc_sharpness ' + arc_sharpness)
}
if (!send_ratio) {
    send_ratio = 5.1;
    console.log('use default send ratio ' + send_ratio)
}

// setup highcharts and gauge
Highcharts.setOptions({
    lang: {
        thousandsSep: ','
    }
});

var chart = new Highcharts.Chart({
    chart: {
        renderTo: 'chart',
        type: 'gauge',
        plotBorderWidth: 1,
        backgroundColor:'transparent',
        margin: [0, 0, 0, 0]
    },
    
    credits: {
        enabled: false
    },
    title: {
        text: 'Pages / Hour<br><span style="font-size: 10px">(outbound)</span>',
        style: {
            color: '#fff'
        },

        verticalAlign: 'bottom',
        y: -85
    },
    pane: {
        startAngle: -150,
        endAngle: 150,
        outerRadius: '100%',
        background: [{
            backgroundColor: 'transparent',
            borderWidth: 0
        }]
        
    },
    plotOptions: {
        gauge: {
            dial: {
                backgroundColor:'rgba(255,255,255,0.85)',
            },
            pivot: {
                radius: 0,
                backgroundColor:'rgba(255,255,255,0.85)',
            },
            dataLabels: {
                borderWidth: 0,
                enabled: false
            }
        },
        labels: {
            style: {
                color: '#fff'
            }
        },
    },               
    // the value axis
    yAxis: {
        min: 0,
        max: 100000 * send_ratio,

        minorTickInterval: 'auto',
        minorTickWidth: 1,
        minorTickLength: 10,
        minorTickPosition: 'outside',
        minorTickColor: 'rgba(255,255,255,0.2)',

        tickPixelInterval: 30,
        tickWidth: 2,
        tickPosition: 'outside',
        tickLength: 10,
        tickColor: 'rgba(255,255,255,0.5)',
        labels: {
            step: 2,
            rotation: 'auto',
            style: {
                color: '#fff',
                fontFamily: 'Titillium Web, sans-serif'
            }
        },
        title: {
            text: ''
        },
        plotBands: [{
            from: 90000  * send_ratio,
            to: 100000  * send_ratio,
            color: '#F40039' // red
        }]
    },
    series: [{
        name: 'Pressure',
        data: [0],
        fillOpacity: 0.1,
        tooltip: {
            valueSuffix: ' pages/h'
        }
    }]
});

FixedQueue.trimHead = function () {
    if (this.length <= this.fixedSize) {
        return;
    }
    Array.prototype.splice.call(this, 0, (this.length - this.fixedSize));
};

FixedQueue.trimTail = function () {
    if (this.length <= this.fixedSize) {
        return;
    }
    Array.prototype.splice.call(this, this.fixedSize, (this.length - this.fixedSize));
};

FixedQueue.wrapMethod = function (methodName, trimMethod) {
    var wrapper = function () {
        var method = Array.prototype[methodName];
        var result = method.apply(this, arguments);
        trimMethod.call(this);
        return (result);
    };
    return (wrapper);
};

FixedQueue.push = FixedQueue.wrapMethod("push", FixedQueue.trimHead);
FixedQueue.splice = FixedQueue.wrapMethod("splice", FixedQueue.trimTail);
FixedQueue.unshift = FixedQueue.wrapMethod("unshift", FixedQueue.trimTail);

var arcs = FixedQueue(max_display, []);
var impacts = FixedQueue(max_display, []);

var getTransaction; // setTimeout var

var transactions = {
    index: 0,
    interval: getRandomInt(timer_min, timer_max),
    init: function () {
        getTransaction = setTimeout(
            jQuery.proxy(this.getData, this),
            this.interval
        );
    },
    shuffleArray(array) {
      	for (var i = array.length - 1; i > 0; i--) {
        	var j = Math.floor(Math.random() * (i + 1));
	        var temp = array[i];
        	array[i] = array[j];
	        array[j] = temp;
	    }
    },	
    getData: function () {
        // prevent memory leak from animating while page is not in focus
        if (document.hasFocus() && this.index < jsonData.length) {
            focus = true;

            var src_lat = jsonData[this.index].DataCenterLat,
                src_long = jsonData[this.index].DataCenterLong,
                datacenter = jsonData[this.index].DataCenterName,
                dst_lat = jsonData[this.index].ToLat,
                dst_long = jsonData[this.index].ToLong,
                dst_city = (jsonData[this.index].ToCity && jsonData[this.index].ToCity != '') ? jsonData[this.index].ToCity + ', ' : '',
                dst_state = (jsonData[this.index].ToState && jsonData[this.index].ToState != '') ? jsonData[this.index].ToState + ', ' : '',
                dst_country = (jsonData[this.index].ToCountry && jsonData[this.index].ToCountry != '') ? jsonData[this.index].ToCountry : '',
                data_type = jsonData[this.index].Type,
                pages = jsonData[this.index].Pages,
                faxes = jsonData[this.index].Faxes,
                combined_count = parseInt(pages) + parseInt(faxes),
                page_text = (pages > 1) ? 'pages' : 'page',
                fax_text = (faxes > 1) ? 'faxes' : 'fax',
                dst_location = (dst_country) ? dst_city + dst_state + dst_country : '[' + src_lat + ', ' + src_long + ']';



            // Specify arc color and impact scale
            if (data_type === 'undefined' || data_type === 'Fax') {
                strokeColor = fax_color;
            } else if (data_type ===  'DirectFax') {
                strokeColor = sen_color;
            } else if (data_type === 'SENx (Encrypted)') {
                strokeColor = senx_color;
		fax_text = (faxes > 1) ? 'documents' : 'document';
            } else if (data_type === 'SEN (Document)') {
                strokeColor = sen_doc_color;
		fax_text = (faxes > 1) ? 'documents' : 'document';
            }

            if (pages >= 100 || faxes >= 100) {
                scale = 3
            } else if ((pages >= 50 && pages < 100) || (faxes >= 50 && faxes < 100)) {
                scale = 2
            } else {
                scale = 1
            }

            page_array.push(parseInt(pages));

            // update send volume chart every 5 transactions
            if (this.index % 5 === 0) {
                if( page_array.length < 155) {
                    page_volume = Math.floor((( (page_array.reduce(totalSum, 0) * 4) * 155) / page_array.length) * send_ratio*5);
                } else {
                    page_volume = Math.floor(((page_array.reduce(totalSum, 0) * 4)) * send_ratio*5);
                }

                //console.log("array length: " + page_array.length + " " + page_volume);

                function totalSum(a, b) {
                    return a + b;
                }

                updateVolume(page_volume)
            }

            // add arcs to the arc queue
            arcs.push({
                origin: {
                    latitude: src_lat,
                    longitude: src_long
                },
                destination: {
                    latitude: dst_lat,
                    longitude: dst_long
                },
                options: {
                    strokeWidth: Math.floor(scale * stroke_width) / 2,
                    strokeColor: strokeColor,
                }
            });
            datamap.arc(arcs);

            // add impacts to the bubbles queue
            impacts.push({
                fillKey: data_type,
                radius: Math.floor(magnitude * impact_radius) * scale,
                latitude: dst_lat,
                longitude: dst_long,
                fillOpacity: 0.5,
                type: data_type,
                from: datacenter,
                to: dst_location,
                pages: pages,
                faxes: faxes
            });
            datamap.bubbles(impacts);

            // update fax and page count
            updateStats(faxes, pages, combined_count);

            // update transaction logs
            updateLogs(strokeColor, data_type, datacenter, pages, page_text, faxes, fax_text, dst_location);

            //console.log(combined_count);

            // update top countries
            updateLocations(top_location, pages, dst_country, dst_state, page_count);

            // update chart
            //pieChart(data_type);

            // pick a new random time and get next transaction
            this.interval = getRandomInt(timer_min, timer_max);
            this.index++;
            this.init();

        } else if (this.index == jsonData.length) {
            this.index, fax_count, sen_count, sen_doc_count, senx_count = 0; // reset index and counters to start over
            clearTimeout(getTransaction);
            console.log('end of file, reloading...');
            requestData(); // load a new JSON file
        } else {
            focus = false;
            clearTimeout(getTransaction);
            console.log('page not in focus');
        }

    },
};

function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] == variable) {
            return pair[1];
        }
    }
    return (false);
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// we maintain a fixed queue of transactions via this class
function FixedQueue(size, initialValues) {
    initialValues = (initialValues || []);
    var queue = Array.apply(null, initialValues);
    queue.fixedSize = size;
    queue.push = FixedQueue.push;
    queue.splice = FixedQueue.splice;
    queue.unshift = FixedQueue.unshift;
    FixedQueue.trimTail.call(queue);
    return (queue);
}

// build the dataMap
function buildMap() {
    console.log('build map');
    datamap = new Datamap({
        element: document.getElementById('action-map'),
        responsive: true,
        scope: 'world',
        fills: {
            'Fax': fax_color,
            'SEN': sen_color,
            'SENx (Encrypted)': senx_color,
            'SEN (Document)': sen_doc_color,
            defaultFill: '#090b0c'
        },
        setProjection: function (element) {
            var projection = d3.geo.mercator()
                .scale($(document).width() / 2 / Math.PI)
                .rotate([10, 0])
                .translate([element.offsetWidth / 2, element.offsetHeight / 2]);

            var path = d3.geo.path().projection(projection);
            return {
                path: path,
                projection: projection
            };
        },
        geographyConfig: {
            dataUrl: null,
            hideAntarctica: true,
            borderWidth: 0.75,
            borderColor: '#003449',
            popupTemplate: function (geography) {
                return '<div class="hoverinfo" style="color:white;background:#090b0c">' +
                    geography.properties.name + '</div>';
            },
            popupOnHover: true,
            highlightOnHover: false,
            highlightFillColor: '#090b0c',
            highlightBorderColor: 'rgba(255, 255, 255, 1)',
            highlightBorderWidth: 0.75
        },
        arcConfig: {
            id: 'arc-container',
            strokeColor: '#DD1C77',
            strokeWidth: 1,
            arcSharpness: arc_sharpness,
            animationSpeed: 600, // Milliseconds
            popupOnHover: false, // True to show the popup while hovering
        },
        bubblesConfig: {
            animate: true,
            popupOnHover: false,
            borderWidth: 0,
            fillOpacity: 0.35,
            highlightOnHover: false,
            highlightFillColor: '#ffffff',
            highlightBorderColor: 'rgba(255, 255, 255, 0.2)',
            highlightBorderWidth: 2,
            highlightBorderOpacity: 1,
            highlightFillOpacity: 0.75,
            popupTemplate: function (data) {
                return '<div class="hoverinfo">' +
                    '<span class="date-time"><b>Type:</b> ' + data.type + '</span><br>' +
                    '<span class="date-time"><b>From:</b> ' + data.from + '</span><br>' +
                    '<span class="date-time"><b>To:</b> ' + data.to + '</span><br>' +
                    '<span class="date-time"><b>Pages:</b> ' + data.pages + '</span><br>' +
                    '<span class="date-time"><b>Faxes:</b> ' + data.faxes + '</span>' +
                    '</div>';
            },
            exitDelay: 0
        },
        done: function (datamap) {
            datamap.svg.attr('version', '1.1').attr('xmlns', 'http://www.w3.org/2000/svg')

            // add zoom function and redraw the map on scale
            datamap.svg.call(d3.behavior.zoom().on("zoom", redraw));
            function redraw() {
                datamap.svg.selectAll("g").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
            }

            drawGrid(32, 0, "rgba(75,75,75,0.2)");
            drawGrid(8, 0, "rgba(75,75,75,0.15)");

            // add map background grid lines
            //datamap.graticule();

            //Definitions for the gradients
            var defs = datamap.svg.append("defs");

            //Filter for the glow effect
            var glow = defs.append("filter").attr("id", "glow").attr("filterUnits", "userSpaceOnUse");
                glow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
            
            var glowMerge = glow.append("feMerge");
                glowMerge.append("feMergeNode").attr("in", "coloredBlur");
                glowMerge.append("feMergeNode").attr("in", "SourceGraphic");

            //Filter for the map backlight
            var backlight = defs.append("filter").attr("id", "backlight").attr("filterUnits", "userSpaceOnUse");
                backlight.append("feGaussianBlur").attr("stdDeviation", "15").attr("result", "blurred");
                backlight.append("feFlood").attr('flood-color', '#003449').attr("result", "glowColor");
                backlight.append("feComposite").attr('in', 'glowColor').attr("in2", "blurred").attr("operator", "in").attr("result", "softGlow_colored");

            var backlightMerge = backlight.append("feMerge");
                backlightMerge.append("feMergeNode").attr("in", "softGlow_colored");
                backlightMerge.append("feMergeNode").attr("in", "SourceGraphic");

            requestData();
        }
    });
}

/* Custom background grid in HTML canvas */
function drawVerticalLine(offset, lineWidth){
    // Plus - horizontal
    context.lineWidth = lineWidth;
    context.save();
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset, canvas.height);
    context.stroke(); 
    context.restore();
}

function drawHorizontalLine(offset, lineWidth){
    // Plus - horizontal
    context.lineWidth = lineWidth;
    context.beginPath();
    context.moveTo(0, offset);
    context.lineTo(canvas.width, offset);
    context.stroke();
}

function drawGrid(gridSize, gridThickness, color){
    var numVertical = Math.floor(canvas.width / (gridSize) );
    var numHorizontal = Math.floor(canvas.height / (gridSize));
    context.strokeStyle = color;
    context.lineWidth = gridThickness;
    context.shadowColor = "rgba(0,0,0,0)";
    context.save();

    for (var i = 1; i < numVertical+1; i++){
        drawVerticalLine(i*gridSize-3, gridThickness);
    }

    for (var i = 1; i < numHorizontal+1; i++){
        drawHorizontalLine(i*gridSize-3, gridThickness);
    }
    context.restore();
}
/* End custom background grid */

function requestData() {
    // request data
    console.log('Request new data');
    $ajax = $.ajax({
        type: 'GET',
        url: json,
        dataType: 'json',
        success: function (data) {
            console.log('JSON loaded ' + data.length + ' items successfully');
            
            jsonData = data;
            page_array = FixedQueue(Math.floor(jsonData.length / (24 * 4)), []); // length of file / 96
			transactions.shuffleArray(jsonData);
            transactions.getData();
        },
        error: function (xhr, ajaxOptions, thrownError) {
            //dir(thrownError);
            //dir(xhr);
            //dir(ajaxOptions);
			console.log(thrownError);
        },
        cache: false
    });
}

function checkPageFocus() {
    if (document.hasFocus() && focus === false) {
        transactions.init();
        //The page is back in focus, resume
    } 
}

function updateStats(faxes, pages) {
    fax_count += parseInt(faxes);
    page_count += parseInt(pages);
    // document.getElementById('fax-count').innerHTML = fax_count.toLocaleString();
    // document.getElementById('page-count').innerHTML = page_count.toLocaleString();
}

function updateLogs(strokeColor, data_type, datacenter, pages, page_text, faxes, fax_text, dst_location) {
    if ($('#transaction-log p').length > 20) {
        $('#transaction-log p:first-child').remove();
        //console.log("remove item");
    }
    if (data_type === 'SENx (Encrypted)' || data_type === 'SEN (Document)') {
    	$('#transaction-log').append('<p style="margin:0px;"><span style="color:' + strokeColor + '">' + data_type + '</span> ' + datacenter + ' ' + ' sent ' + faxes + '</span> ' + fax_text +' to ' + dst_location + '</p>');
    }
    else {
    	$('#transaction-log').append('<p style="margin:0px;"><span style="color:' + strokeColor + '">' + data_type + '</span> ' + datacenter + ' ' + ' sent ' + pages + '</span> ' + page_text + ' / ' + faxes + ' ' + fax_text + ' to ' + dst_location + '</p>');
    }
    $('#transaction-log').animate({
        scrollTop: $('#transaction-log').prop("scrollHeight")
    }, 100);
}

function updateLocations(top_location, pages, dst_country, dst_state, page_count) {
    index = top_location.findIndex(item => (item.country === dst_country) && (item.state === dst_state));
    country = '';
    update_count = parseInt(pages);
    current_location = document.getElementById('rank-' + dst_country + '-' + dst_state);

    // if the location exists in array update the count
    if (current_location) {
        update_count = parseInt( parseInt(pages) + parseInt(top_location[index].count) );
        //update_percent = parseInt( (parseInt(update_count) / parseInt(page_count) ) * 100).toFixed(1)
        //console.log("hit")
        // current_location.getElementsByClassName('count').innerHTML = update_count.toLocaleString();
        // current_location.getElementsByClassName('percent').innerHTML = update_percent;
        
    }
    // check if the location is in the array. if not, add it, if so update the array count value
    if (!top_location.length || !top_location.some(item => (item.country === dst_country) && (item.state === dst_state))) {
        top_location.push({
            country: dst_country,
            state: dst_state,
            count:  pages
        });

        sortLocations(top_location);
    } else {
        // update existing numbers in array
        top_location[index].count = update_count;
        sortLocations(top_location);
    
    }    
    return;
}

function sortLocations(array) {
    top_location.sort(function(a, b) {
        return b.count - a.count;
    });
    //console.log("hit 2")
    top_location_list.innerHTML = ""
    for (var i=0; i<top_location.length; i++) {
        if(i < 12) {
            country+='<li style="margin:0px;" id="rank-' + top_location[i].country + '-' + top_location[i].state + '"><strong>' + top_location[i].state + top_location[i].country + '</strong><span><span class="count" style="display:none;">' + top_location[i].count + '</span> <span class="percentage">' + ((parseInt(top_location[i].count) / parseInt(page_count)) * 100).toFixed(1) + '</span>%</span></li>';
        }
    }
    top_location_list.innerHTML+= country;
}


// Update the volume gauge
function updateVolume(page_volume) {
    var gauge = chart.series[0].points[0];

    gauge.update(page_volume, false);
    chart.redraw();

    //console.log("New Pressure: " + page_volume)
}


// Run the show
buildMap();

$(window).on('resize', function () {
    // resize map
    datamap.resize();
    console.log("resize")
});

$(window).on('load', function () {
    // check for page focus
    setInterval(checkPageFocus, 1000)
});