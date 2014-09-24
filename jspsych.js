/**
 * jspsych.js
 * Josh de Leeuw
 *
 * documentation: https://github.com/jodeleeuw/jsPsych/wiki
 *
 **/
(function($) {
	jsPsych = (function() {

		var core = {};

		//
		// private variables
		//

		// options
		var opts = {};
		// exp structure
		var root_chunk;
		// flow control
		var curr_chunk = 0;
		var global_trial_index = 0;
		var current_trial = {};
		// target DOM element
		var DOM_target;
		// time that the experiment began
		var exp_start_time;

		//
		// public methods
		//

		core.init = function(options) {

			// reset variables
			root_chunk = {};
			opts = {};
			curr_chunk = 0;

			// check if there is a body element on the page
			var default_display_element = $('body');
			if (default_display_element.length === 0) {
				$(document.documentElement).append($('<body>'));
				default_display_element = $('body');
			}

			var defaults = {
				'display_element': default_display_element,
				'on_finish': function(data) {
					return undefined;
				},
				'on_trial_start': function() {
					return undefined;
				},
				'on_trial_finish': function() {
					return undefined;
				},
				'on_data_update': function(data) {
					return undefined;
				},
				'show_progress_bar': false
			};

			// override default options if user specifies an option
			opts = $.extend({}, defaults, options);

			// set target
			DOM_target = opts.display_element;

			// add CSS class to DOM_target
			DOM_target.addClass('jspsych-display-element');
			
			// create experiment structure
			root_chunk = parseExpStructure(opts.experiment_structure);

			startExperiment();
		};

		core.progress = function() {

			var obj = {
				"total_trials": root_chunk.length(),
				"current_trial_global": global_trial_index,
				"current_trial_local": root_chunk.currentTrialLocalIndex(),
				"total_chunks": root_chunk.timeline.length,
				"current_chunk": root_chunk.currentTimelineLocation
			};

			return obj;
		};

		core.startTime = function() {
			return exp_start_time;
		};

		core.totalTime = function() {
			return (new Date()).getTime() - exp_start_time.getTime();
		};

		core.preloadImages = function(images, callback_complete, callback_load) {

			// flatten the images array
			images = flatten(images);

			var n_loaded = 0;
			var loadfn = (typeof callback_load === 'undefined') ? function() {} : callback_load;
			var finishfn = (typeof callback_complete === 'undefined') ? function() {} : callback_complete;

			for (var i = 0; i < images.length; i++) {
				var img = new Image();

				img.onload = function() {
					n_loaded++;
					loadfn(n_loaded);
					if (n_loaded == images.length) {
						finishfn();
					}
				};

				img.src = images[i];
			}
		};

		core.getDisplayElement = function() {
			return DOM_target;
		}
		
		core.finishTrial = function(){
			// logic to advance to next trial?
			
			// handle callback at plugin level
			if (typeof current_trial.on_finish === 'function') {
				current_trial.on_finish(); // TODO: pass in data
			}

			// handle callback at whole-experiment level
			opts.on_trial_finish();

			global_trial_index++;
			
			// advance chunk
			root_chunk.advance();
			
			// update progress bar if shown
			if (opts.show_progress_bar === true) {
				updateProgressBar();
			}
			
			// check if experiment is over
			if(root_chunk.isComplete()){
				finishExperiment();
				return;			
			} 
				
			doTrial(root_chunk.next());
		}
		
		core.currentTrial = function(){
			return current_trial;
		}
		
		core.initSettings = function(){
			return opts;
		}
		
		core.currentChunkID = function(){
			return root_chunk.activeChunkID();
		}
		
		function parseExpStructure(experiment_structure) {
			
			/*var chunks = [];
			
			for(var i=0; i<experiment_structure.length; i++){
				
				var ct = experiment_structure[i].chunk_type;
			
				if(typeof ct !== 'undefined') {
					
					if($.inArray(ct, ["linear", "while"]) > -1){
						chunks.push(createExperimentChunk(experiment_structure[i], i));
					} else {
						throw new Error('Invalid experiment structure definition. Element '+i+' of the experiment_structure array has an invalid chunk_type property');
					}
					
				} else if(typeof experiment_structure[i].type !== 'undefined') {
					
					var temp_chunk = {
						chunk_type: 'linear',
						blocks: [experiment_structure[i]]
					}
					
					chunks.push(createExperimentChunk(temp_chunk));
					
				} else {
					throw new Error('Invalid experiment structure definition. Element '+i+' of the experiment_structure array is improperly defined');
				}
				
				
			}*/
			
			return createExperimentChunk({
				chunk_type: 'root',
				blocks: experiment_structure
			});
			
		}
		
		function createExperimentChunk(chunk_definition, parent_chunk, relative_id){
			
			var chunk = {};
			
			chunk.timeline = parseChunkDefinition(chunk_definition.blocks);
			chunk.parentChunk = parent_chunk;
			chunk.relID = relative_id;
			
			chunk.type = chunk_definition.chunk_type; // root, linear, while
			
			chunk.currentTimelineLocation = 0;
			// this is the current trial since the last time the chunk was reset
			chunk.currentTrialInTimeline = 0;
			// this is the current trial since the chunk started (incl. resets)
			chunk.currentTrialInChunk = 0;
			
			chunk.iteration = 0;
			
			chunk.length = function(){
				// this will recursively get the number of trials on this chunk's timeline
				var n = 0;
				for(var i=0; i<this.timeline.length; i++){
					n += this.timeline[i].length;
				}
				return n;
			}
				
			chunk.activeChunkID = function(){
				if(this.timeline[this.currentTimelineLocation].type === 'block'){
					return this.chunkID();
				} else {
					return this.timeline[this.currentTimelineLocation].activeChunkID();
				}
			}
						
			chunk.chunkID = function() {
				
				if(typeof this.parentChunk === 'undefined') {
					return 0 + "-" + this.iteration;
				} else {
					return this.parentChunk.chunkID() + "." + this.relID + "-" + this.iteration;
				}
				
			}
			
			chunk.next = function() {
				// return the next trial in the block to be run
				
				if(chunk.isComplete()){
					throw new Error('Tried to get completed trial from chunk that is finished.');
				} else {
					return this.timeline[this.currentTimelineLocation].next();
				}
				
			}
			
			chunk.advance = function(){
				// increment the current trial in the chunk
				
				this.timeline[this.currentTimelineLocation].advance();
				
				if(this.timeline[this.currentTimelineLocation].isComplete()){
					this.currentTimelineLocation++;
				} 
				
				this.currentTrialInTimeline++;
				this.currentTrialInChunk++;
				
			}
			
			chunk.isComplete = function() {
				// return true if the chunk is done running trials
				// return false otherwise
				
				// linear chunks just go through the blocks in order and are
				// done when each trial has been completed once
				// the root chunk is a special case of the linear chunk
				if(this.type == 'linear' || this.type == 'root'){
					if (this.currentTimelineLocation >= this.timeline.length) { return true; }
					else { return false; }
				} 
				
				// while chunks play the block again as long as the continue_function
				// returns true
				else if(this.type == 'while'){
					if (this.currentTimelineLocation >= this.timeline.length) { 
						
						if(chunk_definition.continue_function(this.generatedData())){
							this.reset();
							return false;
						} else {
							return true;
						}
						
					} else { 
						return false; 
					}
				}
			}
			
			chunk.currentTrialLocalIndex = function() {
				
				if(this.currentTimelineLocation >= this.timeline.length) {
					return -1;
				}
				
				if(this.timeline[this.currentTimelineLocation].type == 'block'){
					return this.timeline[this.currentTimelineLocation].trial_idx;
				} else {
					return this.timeline[this.currentTimelineLocation].currentTrialLocalIndex();
				}
			}
			
			chunk.generatedData = function() {
				// return an array containing all of the data generated by this chunk for this iteration
				var d = jsPsych.data.getTrialsFromChunk(this.chunkID());
				return d;
			}
			
			chunk.reset = function() {
				this.currentTimelineLocation = 0;
				this.currentTrialInTimeline = 0;
				this.iteration++;
				for(var i = 0; i < this.timeline.length; i++){
					this.timeline[i].reset();
				}
			}
			
			function parseChunkDefinition(chunk_timeline){
				
				var timeline = [];
				
				for (var i = 0; i < chunk_timeline.length; i++) {
					
					
					var ct = chunk_timeline[i].chunk_type;
		
					if(typeof ct !== 'undefined') {
					
						if($.inArray(ct, ["linear", "while"]) > -1){
							timeline.push(createExperimentChunk(chunk_timeline[i], chunk, i));
						} else {
							throw new Error('Invalid experiment structure definition. Element of the experiment_structure array has an invalid chunk_type property');
						}
						
					} else {
						// create a terminal block ... 
						// check to make sure plugin is loaded
						var plugin_name = chunk_timeline[i].type;
						if (typeof jsPsych[plugin_name] === 'undefined') {
							throw new Error("Failed attempt to create trials using plugin type " + plugin_name + ". Is the plugin loaded?");
						}

						var trials = jsPsych[plugin_name].create(chunk_timeline[i]);

						// add options that are generic to all plugins
						trials = addGenericTrialOptions(trials, chunk_timeline[i]);

						timeline.push(createBlock(trials));
					}
				}
				
				return timeline;
			}
			
			return chunk;
			
		}
		
		function createBlock(trial_list) {
			
			var block = {
			
				trial_idx: 0,

				trials: trial_list,
				
				type: 'block',

				next: function() {

					var curr_trial = this.trials[this.trial_idx];
					
					return curr_trial;

				},
				
				isComplete: function() {
					if(this.trial_idx >= this.trials.length){
						return true;
					} else {
						return false;
					}
				},
				
				advance: function() {
					this.trial_idx++;
				},
				
				reset: function() {
					this.trial_idx = 0;
				},
				
				length: trial_list.length
			};

			return block;
		}
		
		function startExperiment() {

			// show progress bar if requested
			if (opts.show_progress_bar === true) {
				drawProgressBar();
			}

			// record the start time
			exp_start_time = new Date();

			// begin!
			doTrial(root_chunk.next());
		}

		function addGenericTrialOptions(trials_arr, opts) {

			// modify this list to add new generic parameters
			var genericParameters = ['type', 'data', 'timing_post_trial', 'on_finish'];

			// default values for generics above
			var defaultValues = [, , 1000, ];

			for (var i = 0; i < genericParameters.length; i++) {
				trials_arr = addParamToTrialsArr(trials_arr, opts[genericParameters[i]], genericParameters[i], defaultValues[i]);
			}

			return trials_arr;

		}

		function addParamToTrialsArr(trials_arr, param, param_name, default_value) {

			if (typeof default_value !== 'undefined') {
				param = (typeof param === 'undefined') ? default_value : param;
			}

			if (typeof param !== 'undefined') {
				if (Array.isArray(param)) {
					// check if data object array is the same length as the number of trials
					if (param.length != trials_arr.length) {
						throw new Error('Invalid specification of parameter ' + param_name + ' in plugin type ' + trials_arr[i].type + '. Length of parameter array does not match the number of trials in the block.');
					} else {
						for (var i = 0; i < trials_arr.length; i++) {
							trials_arr[i][param_name] = param[i];
						}
					}
				} else {
					// use the same data object for each trial
					for (var i = 0; i < trials_arr.length; i++) {
						trials_arr[i][param_name] = param;
					}
				}
			}
			return trials_arr;
		}

		function finishExperiment() {
			opts.on_finish(jsPsych.data.getData());
		}

		function doTrial(trial) {
			
			current_trial = trial;
			
			// call experiment wide callback
			opts.on_trial_start();
			
			// execute trial method
			jsPsych[trial.type].trial(DOM_target, trial);
		}

		function drawProgressBar() {
			$('body').prepend($('<div id="jspsych-progressbar-container"><span>Completion Progress</span><div id="jspsych-progressbar-outer"><div id="jspsych-progressbar-inner"></div></div></div>'));
		}

		function updateProgressBar() {
			var progress = jsPsych.progress();

			var percentComplete = 100 * ((progress.current_chunk) / progress.total_chunks);

			$('#jspsych-progressbar-inner').css('width', percentComplete + "%");
		}

		return core;
	})();

	jsPsych.data = (function() {

		var module = {};
		
		// data storage object
		var allData = [];
		
		module.getData = function() {
			return $.extend(true, [], allData); // deep clone
		}
		
		module.write = function(data_object) {
			
			var progress = jsPsych.progress();
			var trial = jsPsych.currentTrial();

			var default_data = {
				'trial_type': trial.type,
				'trial_index': progress.current_trial_local,
				'trial_index_global': progress.current_trial_global,
				'time_elapsed': jsPsych.totalTime(),
				'internal_chunk_id': jsPsych.currentChunkID()
			};

			var ext_data_object = $.extend({}, data_object, default_data);

			allData.push(ext_data_object);
			
			var initSettings = jsPsych.initSettings();
			initSettings.on_data_update(ext_data_object); //TODO: FIX callback?
		}

		module.dataAsCSV = function(append_data) {
			var dataObj = module.getData();
			return JSON2CSV(flattenData(dataObj, append_data));
		};

		module.localSave = function(filename, format, append_data) {

			var data_string;

			if (format == 'JSON' || format == 'json') {
				data_string = JSON.stringify(flattenData(module.getData(), append_data));
			} else if (format == 'CSV' || format == 'csv') {
				data_string = module.dataAsCSV(append_data);
			} else {
				throw new Error('invalid format specified for jsPsych.data.localSave');
			}

			saveTextToFile(data_string, filename);
		};

		module.getTrialsOfType = function(trial_type) {
			var data = module.getData();

			data = flatten(data);

			var trials = [];
			for (var i = 0; i < data.length; i++) {
				if (data[i].trial_type == trial_type) {
					trials.push(data[i]);
				}
			}

			return trials;
		};
		
		module.getTrialsFromChunk = function(chunk_id) {
			var data = module.getData();

			data = flatten(data);

			var trials = [];
			for (var i = 0; i < data.length; i++) {
				if (data[i].internal_chunk_id.slice(0, chunk_id.length) === chunk_id) { // TODO: change this to starts with
					trials.push(data[i]);
				}
			}

			return trials;
		}

		module.displayData = function(format) {
			format = (typeof format === 'undefined') ? "json" : format.toLowerCase();
			if (format != "json" && format != "csv") {
				console.log('Invalid format declared for displayData function. Using json as default.');
				format = "json";
			}

			var data_string;

			if (format == 'json') {
				data_string = JSON.stringify(flattenData(module.getData()), undefined, 1);
			} else {
				data_string = module.dataAsCSV();
			}

			var display_element = jsPsych.getDisplayElement();

			display_element.append($('<pre>', {
				html: data_string
			}));
		}

		// private function to save text file on local drive

		function saveTextToFile(textstr, filename) {
			var blobToSave = new Blob([textstr], {
				type: 'text/plain'
			});
			var blobURL = "";
			if (typeof window.webkitURL !== 'undefined') {
				blobURL = window.webkitURL.createObjectURL(blobToSave);
			} else {
				blobURL = window.URL.createObjectURL(blobToSave);
			}

			var display_element = jsPsych.getDisplayElement();

			display_element.append($('<a>', {
				id: 'jspsych-download-as-text-link',
				href: blobURL,
				css: {
					display: 'none'
				},
				download: filename,
				html: 'download file'
			}));
			$('#jspsych-download-as-text-link')[0].click();
		}

		//
		// A few helper functions to handle data format conversion
		//

		function flattenData(data_object, append_data) {

			append_data = (typeof append_data === undefined) ? {} : append_data;

			var trials = [];

			// loop through data_object
			for (var i = 0; i < data_object.length; i++) {
				for (var j = 0; j < data_object[i].length; j++) {
					var data = $.extend({}, data_object[i][j], append_data);
					trials.push(data);
				}
			}

			return trials;
		}

		// this function based on code suggested by StackOverflow users:
		// http://stackoverflow.com/users/64741/zachary
		// http://stackoverflow.com/users/317/joseph-sturtevant

		function JSON2CSV(objArray) {
			var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
			var line = '';
			var result = '';
			var columns = [];

			var i = 0;
			for (var j = 0; j < array.length; j++) {
				for (var key in array[j]) {
					var keyString = key + "";
					keyString = '"' + keyString.replace(/"/g, '""') + '",';
					if ($.inArray(key, columns) == -1) {
						columns[i] = key;
						line += keyString;
						i++;
					}
				}
			}

			line = line.slice(0, -1);
			result += line + '\r\n';

			for (var i = 0; i < array.length; i++) {
				var line = '';
				for (var j = 0; j < columns.length; j++) {
					var value = (typeof array[i][columns[j]] === 'undefined') ? '' : array[i][columns[j]];
					var valueString = value + "";
					line += '"' + valueString.replace(/"/g, '""') + '",';
				}

				line = line.slice(0, -1);
				result += line + '\r\n';
			}

			return result;
		}

		return module;

	})();

	jsPsych.turk = (function() {

		// turk info
		var turk_info;

		var module = {};

		// core.turkInfo gets information relevant to mechanical turk experiments. returns an object
		// containing the workerID, assignmentID, and hitID, and whether or not the HIT is in
		// preview mode, meaning that they haven't accepted the HIT yet.
		module.turkInfo = function(force_refresh) {
			// default value is false
			force_refresh = (typeof force_refresh === 'undefined') ? false : force_refresh;
			// if we already have the turk_info and force_refresh is false
			// then just return the cached version.
			if (typeof turk_info !== 'undefined' && !force_refresh) {
				return turk_info;
			} else {

				var turk = {};

				var param = function(url, name) {
					name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
					var regexS = "[\\?&]" + name + "=([^&#]*)";
					var regex = new RegExp(regexS);
					var results = regex.exec(url);
					return (results == null) ? "" : results[1];
				};

				var src = param(window.location.href, "assignmentId") ? window.location.href : document.referrer;

				var keys = ["assignmentId", "hitId", "workerId", "turkSubmitTo"];
				keys.map(

					function(key) {
						turk[key] = unescape(param(src, key));
					});

				turk.previewMode = (turk.assignmentId == "ASSIGNMENT_ID_NOT_AVAILABLE");

				turk.outsideTurk = (!turk.previewMode && turk.hitId === "" && turk.assignmentId == "" && turk.workerId == "")

				turk_info = turk;

				return turk;
			}

		};

		// core.submitToTurk will submit a MechanicalTurk ExternalHIT type

		module.submitToTurk = function(data) {

			var turkInfo = jsPsych.turk.turkInfo();
			var assignmentId = turkInfo.assignmentId;
			var turkSubmitTo = turkInfo.turkSubmitTo;

			if (!assignmentId || !turkSubmitTo) return;

			var dataString = [];

			for (var key in data) {

				if (data.hasOwnProperty(key)) {
					dataString.push(key + "=" + escape(data[key]));
				}
			}

			dataString.push("assignmentId=" + assignmentId);

			var url = turkSubmitTo + "/mturk/externalSubmit?" + dataString.join("&");

			window.location.href = url;
		}

		return module;

	})();

	jsPsych.randomization = (function() {

		var module = {};

		module.repeat = function(array, repetitions, unpack) {

			var arr_isArray = Array.isArray(array);
			var rep_isArray = Array.isArray(repetitions);

			// if array is not an array, then we just repeat the item
			if (!arr_isArray) {
				if (!rep_isArray) {
					array = [array];
					repetitions = [repetitions];
				} else {
					repetitions = [repetitions[0]];
					console.log('Unclear parameters given to randomizeSimpleSample. Multiple set sizes specified, but only one item exists to sample. Proceeding using the first set size.');
				}
			} else {
				if (!rep_isArray) {
					var reps = [];
					for (var i = 0; i < array.length; i++) {
						reps.push(repetitions);
					}
					repetitions = reps;
				} else {
					if (array.length != repetitions.length) {
						// throw warning if repetitions is too short,
						// throw warning if too long, and then use the first N
					}
				}
			}

			// should be clear at this point to assume that array and repetitions are arrays with == length
			var allsamples = [];
			for (var i = 0; i < array.length; i++) {
				for (var j = 0; j < repetitions[i]; j++) {
					allsamples.push(array[i]);
				}
			}

			var out = shuffle(allsamples);

			if (unpack) {
				out = unpackArray(out);
			}

			return shuffle(out);
		}

		module.factorial = function(factors, repetitions, unpack) {

			var factorNames = Object.keys(factors);

			var factor_combinations = [];

			for (var i = 0; i < factors[factorNames[0]].length; i++) {
				factor_combinations.push({});
				factor_combinations[i][factorNames[0]] = factors[factorNames[0]][i];
			}

			for (var i = 1; i < factorNames.length; i++) {
				var toAdd = factors[factorNames[i]];
				var n = factor_combinations.length;
				for (var j = 0; j < n; j++) {
					var base = factor_combinations[j];
					for (var k = 0; k < toAdd.length; k++) {
						var newpiece = {};
						newpiece[factorNames[i]] = toAdd[k];
						factor_combinations.push($.extend({}, base, newpiece));
					}
				}
				factor_combinations.splice(0, n);
			}

			repetitions = (typeof repetitions === 'undefined') ? 1 : repetitions;
			var with_repetitions = module.repeat(factor_combinations, repetitions, unpack);

			return with_repetitions;
		}

		function unpackArray(array) {

			var out = {};

			for (var i = 0; i < array.length; i++) {
				var keys = Object.keys(array[i]);
				for (var k = 0; k < keys.length; k++) {
					if (typeof out[keys[k]] === 'undefined') {
						out[keys[k]] = [];
					}
					out[keys[k]].push(array[i][keys[k]]);
				}
			}

			return out;
		}

		function shuffle(array) {
			var m = array.length,
				t, i;

			// While there remain elements to shuffle…
			while (m) {

				// Pick a remaining element…
				i = Math.floor(Math.random() * m--);

				// And swap it with the current element.
				t = array[m];
				array[m] = array[i];
				array[i] = t;
			}

			return array;
		}

		return module;

	})();

	jsPsych.pluginAPI = (function() {

		// keyboard listeners
		var keyboard_listeners = [];

		var module = {};

		module.getKeyboardResponse = function(callback_function, valid_responses, rt_method, persist) {

			rt_method = (typeof rt_method === 'undefined') ? 'date' : rt_method;
			if (rt_method != 'date' && rt_method != 'performance') {
				console.log('Invalid RT method specified in getKeyboardResponse. Defaulting to "date" method.');
				rt_method = 'date';
			}

			var start_time;
			if (rt_method == 'date') {
				start_time = (new Date()).getTime();
			}
			if (rt_method == 'performance') {
				start_time = performance.now();
			}

			var listener_id;

			var listener_function = function(e) {

				var key_time;
				if (rt_method == 'date') {
					key_time = (new Date()).getTime();
				}
				if (rt_method == 'performance') {
					key_time = performance.now();
				}

				var valid_response = false;
				if (typeof valid_responses === 'undefined' || valid_responses.length === 0) {
					valid_response = true;
				}
				for (var i = 0; i < valid_responses.length; i++) {
					if (typeof valid_responses[i] == 'string') {
						if (typeof keylookup[valid_responses[i]] !== 'undefined') {
							if (e.which == keylookup[valid_responses[i]]) {
								valid_response = true;
							}
						} else {
							throw new Error('Invalid key string specified for getKeyboardResponse');
						}
					} else if (e.which == valid_responses[i]) {
						valid_response = true;
					}
				}

				if (valid_response) {

					var after_up = function(up) {

						if (up.which == e.which) {
							$(document).off('keyup', after_up);

							if ($.inArray(listener_id, keyboard_listeners) > -1) {

								if (!persist) {
									// remove keyboard listener
									module.cancelKeyboardResponse(listener_id);
								}

								callback_function({
									key: e.which,
									rt: key_time - start_time
								});
							}
						}
					};

					$(document).keyup(after_up);
				}
			};

			$(document).keydown(listener_function);

			// create listener id object
			listener_id = {
				type: 'keydown',
				fn: listener_function
			};

			// add this keyboard listener to the list of listeners
			keyboard_listeners.push(listener_id);

			return listener_id;

		};

		module.cancelKeyboardResponse = function(listener) {
			// remove the listener from the doc
			$(document).off(listener.type, listener.fn);

			// remove the listener from the list of listeners
			if ($.inArray(listener, keyboard_listeners) > -1) {
				keyboard_listeners.splice($.inArray(listener, keyboard_listeners), 1);
			}
		};

		module.cancelAllKeyboardResponses = function() {
			for (var i = 0; i < keyboard_listeners.length; i++) {
				$(document).off(keyboard_listeners[i].type, keyboard_listeners[i].fn);
			}
			keyboard_listeners = [];
		};

		// keycode lookup associative array
		var keylookup = {
			'backspace': 8,
			'tab': 9,
			'enter': 13,
			'shift': 16,
			'ctrl': 17,
			'alt': 18,
			'pause': 19,
			'capslock': 20,
			'esc': 27,
			'space': 32,
			'spacebar': 32,
			' ': 32,
			'pageup': 33,
			'pagedown': 34,
			'end': 35,
			'home': 36,
			'leftarrow': 37,
			'uparrow': 38,
			'rightarrow': 39,
			'downarrow': 40,
			'insert': 45,
			'delete': 46,
			'0': 48,
			'1': 49,
			'2': 50,
			'3': 51,
			'4': 52,
			'5': 53,
			'6': 54,
			'7': 55,
			'8': 56,
			'9': 57,
			'a': 65,
			'b': 66,
			'c': 67,
			'd': 68,
			'e': 69,
			'f': 70,
			'g': 71,
			'h': 72,
			'i': 73,
			'j': 74,
			'k': 75,
			'l': 76,
			'm': 77,
			'n': 78,
			'o': 79,
			'p': 80,
			'q': 81,
			'r': 82,
			's': 83,
			't': 84,
			'u': 85,
			'v': 86,
			'w': 87,
			'x': 88,
			'y': 89,
			'z': 90,
			'A': 65,
			'B': 66,
			'C': 67,
			'D': 68,
			'E': 69,
			'F': 70,
			'G': 71,
			'H': 72,
			'I': 73,
			'J': 74,
			'K': 75,
			'L': 76,
			'M': 77,
			'N': 78,
			'O': 79,
			'P': 80,
			'Q': 81,
			'R': 82,
			'S': 83,
			'T': 84,
			'U': 85,
			'V': 86,
			'W': 87,
			'X': 88,
			'Y': 89,
			'Z': 90,
			'0numpad': 96,
			'1numpad': 97,
			'2numpad': 98,
			'3numpad': 99,
			'4numpad': 100,
			'5numpad': 101,
			'6numpad': 102,
			'7numpad': 103,
			'8numpad': 104,
			'9numpad': 105,
			'multiply': 106,
			'plus': 107,
			'minus': 109,
			'decimal': 110,
			'divide': 111,
			'F1': 112,
			'F2': 113,
			'F3': 114,
			'F4': 115,
			'F5': 116,
			'F6': 117,
			'F7': 118,
			'F8': 119,
			'F9': 120,
			'F10': 121,
			'F11': 122,
			'F12': 123,
			'=': 187,
			',': 188,
			'.': 190,
			'/': 191,
			'`': 192,
			'[': 219,
			'\\': 220,
			']': 221
		};

		//
		// These are public functions, intended to be used for developing plugins.
		// They aren't considered part of the normal API for the core library.
		//

		module.normalizeTrialVariables = function(trial, protect) {

			protect = (typeof protect === 'undefined') ? [] : protect;

			var keys = getKeys(trial);

			var tmp = {};
			for (var i = 0; i < keys.length; i++) {

				var process = true;
				for (var j = 0; j < protect.length; j++) {
					if (protect[j] == keys[i]) {
						process = false;
						break;
					}
				}

				if (typeof trial[keys[i]] == "function" && process) {
					tmp[keys[i]] = trial[keys[i]].call();
				} else {
					tmp[keys[i]] = trial[keys[i]];
				}

			}

			return tmp;

		};

		// if possible_array is not an array, then return a one-element array
		// containing possible_array
		module.enforceArray = function(params, possible_arrays) {

			// function to check if something is an array, fallback
			// to string method if browser doesn't support Array.isArray
			var ckArray = Array.isArray || function(a) {
					return toString.call(a) == '[object Array]';
				};

			for (var i = 0; i < possible_arrays.length; i++) {
				if (typeof params[possible_arrays[i]] !== 'undefined') {
					params[possible_arrays[i]] = ckArray(params[possible_arrays[i]]) ? params[possible_arrays[i]] : [params[possible_arrays[i]]];
				}
			}

			return params;
		};

		function getKeys(obj) {
			var r = [];
			for (var k in obj) {
				if (!obj.hasOwnProperty(k)) continue;
				r.push(k);
			}
			return r;
		}

		return module;
	})();

	// methods used in multiple modules

	// private function to flatten nested arrays

	function flatten(arr, out) {
		out = (typeof out === 'undefined') ? [] : out;
		for (var i = 0; i < arr.length; i++) {
			if (Array.isArray(arr[i])) {
				flatten(arr[i], out);
			} else {
				out.push(arr[i]);
			}
		}
		return out;
	}

})(jQuery);
