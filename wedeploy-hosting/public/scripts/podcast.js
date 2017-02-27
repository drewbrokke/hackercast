const app = new Vue({
	data: {
		audio: null,
		currentTime: null,
		duration: null,
		listeners: null,
		nickname,
		paused: null,
		podcast: null,
		progress: 0,
		socket,
		volume: 1
	},

	computed: {
		progress: function() {
			return Math.floor((this.currentTime / this.duration) * 100);
		}
	},

	el: '#podcast',

	beforeDestroy: function() {
		alert('Destroy!');
	},

	created: function() {
		this.socket.on('podcast-found', podcast => {
			this.podcast = podcast;

			this._initData();
			this._bindAudioEvents();
			this._bindSocketEvents();
		});

		this.socket.emit('podcast-request-single', podcastId);
	},

	watch: {
		volume: function() {
			this.audio.volume = this.volume;
		}
	},

	methods: {
		backwards: function() {
			this._scrub(-30);
		},
		emitPause: function() {
			this.podcast.currentTime = this.audio.currentTime;
			this.podcast.paused = true;

			this.socket.emit('podcast-pause', {podcast: this.podcast, nickname});
		},
		emitPlay: function() {
			this.podcast.startTime = Math.floor((new Date).getTime() - (this.currentTime * 1000));
			this.podcast.paused = false;

			this.socket.emit('podcast-play', {podcast: this.podcast, nickname});
		},
		forward: function() {
			this._scrub(30);
		},
		toggle: function() {
			this.paused ? this.emitPlay() : this.emitPause();
		},
		_bindAudioEvents: function() {
			this.audio = new Audio(`${this.podcast.src}`);

			let syncViewToAudio = (property) => this[property] = this.audio[property];

			this.audio.oncanplaythrough = () => this.paused ? "" : this.audio.play();
			this.audio.onloadeddata = () => this.audio.currentTime = this.currentTime;

			this.audio.ondurationchange = () => syncViewToAudio('duration');
			this.audio.ontimeupdate = () => syncViewToAudio('currentTime');

			this.audio.onpause = () => syncViewToAudio('paused');
			this.audio.onplay = () => syncViewToAudio('paused');
		},
		_bindSocketEvents: function() {
			this.socket.on('podcast-pause', () => this.audio.pause());
			this.socket.on('podcast-play', () => this.audio.play());
			this.socket.on('podcast-scrub', this._updateFromScrub);
		},
		_initData: function() {
			this.currentTime = this.podcast.paused
				? this.podcast.currentTime
				: ((new Date).getTime() - this.podcast.startTime) / 1000;

			this.paused = this.podcast.paused;
		},
		_scrub: function(seconds) {
			const newTime = this.audio.currentTime + seconds;

			this.socket.emit('podcast-scrub', {podcast: this.podcast, newTime, nickname});
		},
		_updateFromScrub: function(podcast) {
			this.audio.currentTime = podcast.currentTime;
			this.currentTime = podcast.currentTime;
			this.podcast = podcast;
		}
	}
});