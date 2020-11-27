const fs = require("fs");
const d3 = require("d3");

var global_initialized = false;
var global_split_data = {};
var global_all_cores = [];
var global_all_events = [];
var global_slice_line_idx = 0;
var global_selected_cores = [];
var global_selected_events = [];

var global_bar_core_core = 0;
var global_bar_core_events = [];
var global_bar_event_cores = [];
var global_bar_event_event = null;

var global_bar_color_pallette = [
    "#003f5c",
    "#d45087",
    "#2f4b7c",
    "#f95d6a",
    "#665191",
    "#ff7c43",
    "#a05195",
    "#ffa600"
];

function draw_bar_chart_for_id(id, data, xlabel, ylabel, colorful, long_labels) {
    const max_width = window.innerWidth * 0.26;
    const margin = { top: 10, right: 10, bottom: 200, left: 80 },
        width = max_width - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

    d3.select("#" + id).html("");
    const svg = d3.select("#" + id).append("svg")
        .attr("class", "chart chart-bar")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    const max_value = d3.max(data, function(d) { return d.value; });

    const x_scale = d3.scaleBand().range([0, width]).padding(0.4).domain(data.map(function(d) { return d.key; })),
        y_scale = d3.scaleLinear().range([height, 0]).domain([0, max_value]);

    const g = svg.append("g")
        .attr("class", "chart-focus chart-focus-bar")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    const x_axis = g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x_scale));
    if (long_labels) {
        x_axis.selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");
    }
    g.append("g")
        .call(d3.axisLeft(y_scale));
    g.selectAll(".bar-" + id)
        .data(data)
        .enter().append("rect")
            .attr("fill", function(d, i) {
                if (colorful) {
                    return global_bar_color_pallette[i % global_bar_color_pallette.length];
                } else {
                    return "steelblue";
                }
            })
            .attr("class", "bar-" + id)
            .attr("x", function(d) { return x_scale(d.key); })
            .attr("y", function(d) { return y_scale(d.value); })
            .attr("width", x_scale.bandwidth())
            .attr("height", function(d) { return height - y_scale(d.value); });
    if (!long_labels) {
        svg.append("text")
            .attr("class", "axis_label axis_label-bar_chart")
            .attr("transform", "translate(" + (margin.left + width / 2) + "," + (height + margin.top + 30) + ")")
            .style("text-anchor", "middle")
            .text(xlabel);
    }
    svg.append("text")
        .attr("class", "axis_label axis_label-bar_chart")
        .attr("transform", "rotate(-90)")
        .attr("y", 0)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text(ylabel);
}

function draw_bar_chart_for_core() {
    const core = global_bar_core_core;
    if (core == null) {
        return;
    }

    let data = [];
    for (const evname of global_bar_core_events) {
        const tdata = global_split_data[core][evname];
        let line_idx = Math.floor(Math.min(tdata.length - 1, Math.max(0, global_slice_line_idx)));
        data.push({key: evname, value: tdata[line_idx].value});
    }
    document.getElementById("chart_area-bar-core").innerHTML = "";
    draw_bar_chart_for_id("chart_area-bar-core", data, "event", "value", true, true);
}

function draw_bar_chart_for_event() {
    const evname = global_bar_event_event;
    if (!evname) {
        return;
    }
    let data = [];
    for (const core of global_bar_event_cores) {
        let tdata = global_split_data[core][evname];
        let line_idx = Math.floor(Math.min(tdata.length - 1, Math.max(0, global_slice_line_idx)));
        data.push({key: core, value: tdata[line_idx].value});
    }
    document.getElementById("chart_area-bar-event").innerHTML = "";
    draw_bar_chart_for_id("chart_area-bar-event", data, "core", evname, false, false);
}

function draw_bar_charts() {
    draw_bar_chart_for_core();
    draw_bar_chart_for_event();
}

function draw_single_line_chart(id, evname, core) {
    const data = global_split_data[core][evname];

    const margin = { top: 10, right: 10, bottom: 120, left: 90 },
        margin2 = { top: 435, right: 10, bottom: 20, left: 90 },
        width = 800 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom,
        height2 = 500 - margin2.top - margin2.bottom,
        svg_height = 510;

    // Get max range for values
    const max_time = d3.max(data, function(d) { return d.time; });
    const max_value = d3.max(data, function(d) { return d.value; }) + 1000;

    // Initialize scales
    const x_scale = d3.scaleLinear().range([0, width]).domain([0, max_time]),
        x_scale_2 = d3.scaleLinear().range([0, width]).domain([0, max_time]); // Duplicate scale for brush
    const y_scale = d3.scaleLinear().range([height, 0]).domain([0, max_value]),
        y_scale_2 = d3.scaleLinear().range([height2, 0]).domain([0, max_value]); // Duplicate scale for brush

    // Create axes
    const x_axis = d3.axisBottom(x_scale),
        x_axis_2 = d3.axisBottom(x_scale_2); // X axis for brush slider
    const y_axis = d3.axisLeft(y_scale);

    // Create the SVG
    const svg = d3.select("#" + id).append("svg")
        .attr("class", "chart chart-line")
        .attr("width", width + margin.left + margin.right)
        .attr("height", svg_height);

    const zoom = d3.zoom()
        .scaleExtent([1, Infinity])
        .translateExtent([[0, 0], [width, height]])
        .extent([[0, 0], [width, height]])
        .on("zoom", on_zoom);

    // Clip lines that go outside bounds when zooming
    const clip_id = "chart-line-clip-" + evname.replace(".", "_") + "-" + core;
    const clip = svg.append("defs").append("svg:clipPath")
        .attr("id", clip_id)
        .append("svg:rect")
            .attr("width", width)
            .attr("height", height)
            .attr("x", 0)
            .attr("y", 0);

    // Draw line chart
    const line = d3.line()
        .x(function(d) { return x_scale(d.time); })
        .y(function(d) { return y_scale(d.value); });
    const line_chart = svg.append("g")
        .attr("class", "chart-focus chart-focus-line")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .attr("clip-path", "url(#" + clip_id + ")");
    line_chart.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5)
        .attr("class", "line line-data")
        .attr("d", line);

    // Draw axes
    const axes = svg.append("g")
        .attr("class", "chart-focus chart-focus-axes")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    axes.append("g")
        .attr("class", "chart-axis chart-axis-x")
        .attr("transform", "translate(0," + height + ")")
        .call(x_axis);
    axes.append("g")
        .attr("class", "chart-axis chart-axis-y")
        .call(y_axis);

    // Add axis labels
    svg.append("text")
        .attr("class", "axis_label axis_label-line_chart")
        .attr("transform", "translate(" + (margin.left + width / 2) + "," + (height + margin.top + 40) + ")")
        .style("text-anchor", "middle")
        .text("time (ms)");
    svg.append("text")
        .attr("class", "axis_label axis_label-line_chart")
        .attr("transform", "rotate(-90)")
        .attr("y", 0)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text(evname + " (core " + core + ")");

    // Draw brush
    const brush = d3.brushX()
        .extent([[0, 0], [width, height2]])
        .on("brush end", on_brush_end);
    const line_2 = d3.line()
        .x(function(d) { return x_scale_2(d.time); })
        .y(function(d) { return y_scale_2(d.value); });
    const brush_context = svg.append("g")
        .attr("class", "brush-context")
        .attr("transform", "translate(" + margin2.left + "," + margin2.top + ")")
    brush_context.append("path")
        .datum(data)
        .attr("fill", "steelblue")
        .attr("class", "line line-brush")
        .attr("d", line_2);
    brush_context.append("g")
        .attr("class", "chart-brush-axis chart-brush-axis-x")
        .attr("transform", "translate(0," + height2 + ")")
        .call(x_axis_2);
    brush_context.append("g")
        .attr("class", "brush")
        .call(brush)
        .call(brush.move, x_scale.range());

    // Drag behavior
    const drag = d3.drag().on("drag", on_drag);
    // Draw slice line
    global_slice_line_idx = data.length / 4;
    const slice_x = margin2.left + width * global_slice_line_idx / data.length;
    const slice_y1 = margin2.top - 10;
    const slice_y2 = height2 + margin2.top + margin2.bottom + 10;
    const drag_line = svg.append("line")
        .attr("class", "chart-line-drag")
        .style("stroke", "black")
        .style("stroke-width", 3)
        .attr("x1", slice_x)
        .attr("x2", slice_x)
        .attr("y1", slice_y1)
        .attr("y2", slice_y2)
        .call(drag);

    // Invisible rectangle for zoom
    svg.append("rect")
        .attr("class", "chart-line-zoom_rect")
        .attr("width", width)
        .attr("height", height)
        .style("opacity", 0)
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .call(zoom);

    function on_brush_end(e) {
        if (!e.sourceEvent || e.sourceEvent.type == "zoom") { return; }
        let s = e.selection || x_scale_2.range();
        x_scale.domain(s.map(x_scale_2.invert, x_scale_2));
        line_chart.select(".line").attr("d", line);
        axes.select(".chart-axis-x").call(x_axis);
        svg.select(".chart-line-zoom-rect")
            .call(zoom.transform,
                d3.zoomIdentity.scale(width / (s[1] - s[0])).translate(-s[0], 0));
    }

    function on_zoom(e) {
        if (!e.sourceEvent || e.sourceEvent.type == "brush") { return; }
        let t = e.transform;
        x_scale.domain(t.rescaleX(x_scale_2).domain());
        line_chart.select(".line").attr("d", line);
        axes.select(".chart-axis-x").call(x_axis);
        brush_context.select(".brush").call(brush.move, x_scale.range().map(t.invertX, t));
    }

    function on_drag(e) {
        let x = Math.max(margin2.left, Math.min(e.x, width + margin2.left));
        d3.selectAll(".chart-line-drag").attr("x1", x).attr("x2", x);
        global_slice_line_idx = (x - margin2.left) * data.length / width;

        // Update bar charts
        draw_bar_charts();
    }
}

function draw_line_charts() {
    // Clear existing HTML
    const line_chart_area = document.getElementById("chart_area-line");
    line_chart_area.innerHTML = "";

    // Draw line charts
    for (const core of global_selected_cores) {
        // Create div for row of charts
        const line_div = document.createElement('div');
        line_div.classList.add("chart_area-line-row");
        line_div.id = "chart_area-line-row-" + core;
        line_chart_area.appendChild(line_div);

        // Add an SVG in row for each event
        for (const evname of global_selected_events) {
            draw_single_line_chart(line_div.id, evname, core);
        }
    }
}

function redraw_everything() {
    draw_line_charts();
    draw_bar_charts();
}

function load_data(csv_path) {
    let idx_to_event_core = [null];

    global_split_data = {};
    global_all_events = [];
    global_all_cores = [];
    global_slice_line_idx = 0;
    global_selected_cores = [];
    global_selected_events = [];

    global_bar_core_core = 0;
    global_bar_core_events = [];
    global_bar_event_cores = [];
    global_bar_event_event = null;

    const data = fs.readFileSync(csv_path, 'utf-8');
    const lines = data.split('\n');

    // Parse header line
    const header_line = lines[0].split(',');
    for (let i = 1; i < header_line.length; i++) {
        const split = header_line[i].split('-');
        const evname = split[0];
        const core = +split[1];
        idx_to_event_core.push([evname, core]);
        if (!global_all_cores.includes(core)) {
            global_all_cores.push(core);
        }
        if (!global_all_events.includes(evname)) {
            global_all_events.push(evname);
        }
        if (!(core in global_split_data)) {
            global_split_data[core] = {};
        }
        if (!(evname in global_split_data[core])) {
            global_split_data[core][evname] = [];
        }
    }

    // Select everything
    for (let core of global_all_cores) {
        global_selected_cores.push(core);
        global_bar_event_cores.push(core);
    }
    for (let i = 0; i < global_all_events.length; i++) {
        global_selected_events.push(global_all_events[i]);
        global_bar_core_events.push(global_all_events[i]);
    }
    global_bar_event_event = global_selected_events[0];

    // Parse other lines
    for (let lidx = 1; lidx < lines.length; lidx++) {
        const line = lines[lidx].split(',');
        const time = +line[0];
        for (let i = 1; i < line.length; i++) {
            const value = +line[i];
            const evname = idx_to_event_core[i][0];
            const core = idx_to_event_core[i][1];
            global_split_data[core][evname].push({ time: time, value: value });
        }
    }
}

function toggle_thing_in_list(source_list, list, thing) {
    let j = 0;
    for (let i = 0; j < list.length && i < source_list.length; i++) {
        if (source_list[i] == thing) {
            if (list[j] == thing) {
                list.splice(j, 1);
            } else {
                list.splice(j, 0, thing);
            }
            return;
        }
        if (source_list[i] == list[j]) {
            j++;
        }
    }
    list.push(thing);
}

function toggle_dropdown(id) {
    let dropdown = document.getElementById(id);
    if (dropdown.style.display == "none") {
        dropdown.style.display = "block";
    } else {
        dropdown.style.display = "none";
    }
}

function fill_multi_dropdown(id, source_list, dest_list, callback) {
    let dropdown = document.getElementById(id);
    dropdown.style.display = "none";
    let list = dropdown.children[0];
    list.innerHTML = "";

    for (const thing of source_list) {
        const entry = document.createElement("div");
        entry.innerText = "" + thing;
        entry.classList.add("dropdown-entry", "dropdown-entry-selected");
        entry.onclick = function() {
            entry.classList.toggle("dropdown-entry-selected");
            toggle_thing_in_list(source_list, dest_list, thing);
            callback();
        };
        list.appendChild(entry);
    }
}

function fill_main_dropdowns() {
    fill_multi_dropdown("selection-main-cores", global_all_cores, global_selected_cores, function() {
        fill_bar_dropdowns();
        redraw_everything();
    });
    fill_multi_dropdown("selection-main-events", global_all_events, global_selected_events, function() {
        fill_bar_dropdowns();
        redraw_everything();
    });
}

function fill_single_dropdown(id, source_list, callback) {
    let dropdown = document.getElementById(id);
    dropdown.style.display = "none";
    let list = dropdown.children[0];
    list.innerHTML = "";

    for (const thing of source_list) {
        const entry = document.createElement("div");
        entry.innerText = "" + thing;
        entry.classList.add("dropdown-entry");
        entry.onclick = function() {
            for (let i = 0; i < list.children.length; i++) {
                list.children[i].classList.remove("dropdown-entry-selected");
            }
            entry.classList.add("dropdown-entry-selected");
            callback(thing);
        };
        list.appendChild(entry);
    }

    list.children[0].classList.add("dropdown-entry-selected");
}

function update_bar_core_legend() {
    let table = document.getElementById("chart-bar-core-legend-contents");
    table.innerHTML = "";

    for (let i = 0; i < global_bar_core_events.length; i++) {
        let entry = document.createElement("div");
        entry.classList.add("legend-entry");

        let color_div = document.createElement("div");
        color_div.classList.add("legend-color");
        color_div.style.backgroundColor = global_bar_color_pallette[i % global_bar_color_pallette.length];

        let text_div = document.createElement("div");
        text_div.innerText = global_bar_core_events[i];

        entry.appendChild(color_div);
        entry.appendChild(text_div);

        table.appendChild(entry);
    }
}

function reset_bar_selections() {
    global_bar_core_events = [];
    global_bar_event_cores = [];
    global_bar_core_core = global_selected_cores.length > 0 ? global_selected_cores[0] : null;
    global_bar_event_event = global_selected_events.length > 0 ? global_selected_events[0] : null;

    for (let core of global_selected_cores) {
        global_bar_event_cores.push(core);
    }
    for (let evname of global_selected_events) {
        global_bar_core_events.push(evname);
    }
}

function fill_bar_dropdowns() {
    reset_bar_selections();
    update_bar_core_legend();

    fill_multi_dropdown("selection-bar-core-events", global_selected_events, global_bar_core_events, function() {
        update_bar_core_legend();
        draw_bar_charts();
    });
    fill_multi_dropdown("selection-bar-event-cores", global_selected_cores, global_bar_event_cores, draw_bar_charts);
    fill_single_dropdown("selection-bar-core-core", global_selected_cores, function(core) {
        global_bar_core_core = core;
        draw_bar_charts();
    });
    fill_single_dropdown("selection-bar-event-event", global_selected_events, function(event) {
        global_bar_event_event = event;
        draw_bar_charts();
    });
}

function initial_draw(path) {
    load_data(path);
    fill_main_dropdowns()
    fill_bar_dropdowns()
    global_initialized = true;
    draw_line_charts();
    draw_bar_charts();
}

window.onresize = function() {
    if (global_initialized) {
        draw_bar_charts();
    }
}