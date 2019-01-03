const config = require('./config');

const Koa = require('koa');
const serve = require('koa-static');
const debug = require('debug')('snake');
const assert = require('assert');
const crypto = require('crypto');
const axios = require('axios');

const app = new Koa();
const server = require('http').createServer(app.callback());
const io = require('socket.io')(server);

const redis = require('./lib/redis');
const Grid = require('./lib/Grid');
const Snake = require('./lib/Snake');
const Food = require('./lib/Food');
const detectCollisions = require('./lib/detectCollisions');
const coinhive = require('./lib/coinhive');


app.use(serve(`${__dirname}/public`));

const grid = new Grid(50);

const blockHashes = 250;

io.on('connection', socket => {
	socket.on('init', async privateKey => {
		const publicKey = (() => {
			const hash = crypto.createHash('sha256');

			hash.update(privateKey, 'hex');

			return hash.digest('hex');
		})();

		console.log({ privateKey, publicKey });

		const snake = new Snake(grid.getRandomEmptyBlock());

		snake.publicKey = publicKey;

		grid.addEntity(snake);

		socket.emit('snakeId', snake.id);
		socket.emit('entities', [ ...grid.entities ]);

		socket.on('direction', direction => {
			snake.lastInput = Date.now();
			snake.direction = direction;
		});

		socket.on('disconnect', async () => {
			await snake.die();
			grid.removeEntity(snake);
		});

		socket.emit('mining-id', process.env.COINHIVE_SITE_KEY);

		socket.on('add-block', async () => {
			snake.appendBlockFromBalance();
		});

		socket.on('remove-block', async () => {
			snake.popBlock();
		});

		snake.on('tick', async () => {
			socket.emit('balance', Math.floor(await redis.get(`balance:${publicKey}`) / blockHashes || 0))
		});

	});
});

const fps = 5;

setInterval(async () => {
	await grid.tick();

	io.emit('entities', [ ...grid.entities ]);
	io.emit('server-balance', (await redis.get('server-balance')) / blockHashes);
	io.emit('server-food', (await redis.get('server-food')) / blockHashes);
}, 1000 / fps);

server.listen(process.env.SERVER_PORT || 3000);
