const Koa = require('koa');
const serve = require('koa-static');

const app = new Koa();
app.use(serve(`${__dirname}`));

const server = require('http').createServer(app.callback());
const io = require('socket.io')(server);

const snakes = [];
let id = 0;

io.on('connection', socket => {
	const snake = {
		x: 5,
		y: 5,
		direction: 'up',
		id: id++
	};

	snakes.push(snake);

	socket.emit('snakeId', snake.id);
	socket.emit('snakes', snakes);

	socket.on('direction', direction => {
		snake.direction = direction;
	});

	socket.on('disconnect', () => {
		snakes.splice(snakes.indexOf(snake), 1);
	});
});

const fps = 3.5;

setInterval(() => {
	const canvasBox = 10;

	for(const snake of snakes) {
		({
			'up': () => {
				if(--snake.x === 0)
					snake.direction = 'down';
			},
			'down': () => {
				if(++snake.x === canvasBox - 1)
					snake.direction = 'up';
			},
			'left': () => {
				if(--snake.y === 0)
					snake.direction = 'right';
			},
			'right': () => {
				if(++snake.y === canvasBox - 1)
					snake.direction = 'left';
			}
		})[snake.direction]();
	}

	io.emit('snakes', snakes);
}, 1000 / fps);

server.listen(3055);
