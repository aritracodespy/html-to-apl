const road = document.getElementById('road');
const playerCar = document.getElementById('playerCar');
const scoreDisplay = document.getElementById('scoreDisplay');
const coinDisplay = document.getElementById('coinDisplay');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const finalScoreDisplay = document.getElementById('finalScore');

let gameRunning = false;
let score = 0;
let coins = 0;
let playerCarX = 50; // Percentage of road width
let playerCarSpeed = 0; // -1 for left, 1 for right, 0 for stop
let enemyCars = [];
let coinsOnRoad = [];
let animationFrameId;
let carSpeed = 5; // Initial enemy car speed
let enemySpawnInterval = 1500; // Milliseconds
let coinSpawnInterval = 2000; // Milliseconds
let lastEnemySpawnTime = 0;
let lastCoinSpawnTime = 0;
let roadPosition = 0; // For road animation

// Game constants
const PLAYER_CAR_WIDTH_PERCENT = 10;
const ENEMY_CAR_WIDTH_PERCENT = 10;
const COIN_WIDTH_PERCENT = 8;
const PLAYER_CAR_BOTTOM_OFFSET = 50; // px from bottom

function startGame() {
    gameRunning = true;
    score = 0;
    coins = 0;
    playerCarX = 50;
    playerCar.style.left = `${playerCarX}%`;
    playerCarSpeed = 0;
    enemyCars.forEach(car => car.remove());
    enemyCars = [];
    coinsOnRoad.forEach(coin => coin.remove());
    coinsOnRoad = [];
    scoreDisplay.textContent = `Score: ${score}`;
    coinDisplay.textContent = `Coins: ${coins}`;
    carSpeed = 5; // Reset speed
    enemySpawnInterval = 1500; // Reset interval
    coinSpawnInterval = 2000;
    lastEnemySpawnTime = performance.now();
    lastCoinSpawnTime = performance.now();
    roadPosition = 0;

    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');

    gameLoop();
}

function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    finalScoreDisplay.textContent = `Your Score: ${score}`;
    gameOverScreen.classList.add('active');
}

function gameLoop(currentTime) {
    if (!gameRunning) return;

    // Road animation
    roadPosition = (roadPosition + carSpeed * 0.1) % 200; // Adjust speed multiplier
    road.style.backgroundPositionY = `${roadPosition}px`;

    // Player car movement
    playerCarX += playerCarSpeed * 2; // Adjust player car movement speed
    playerCarX = Math.max(PLAYER_CAR_WIDTH_PERCENT / 2, Math.min(100 - PLAYER_CAR_WIDTH_PERCENT / 2, playerCarX));
    playerCar.style.left = `${playerCarX}%`;

    // Spawn enemy cars
    if (currentTime - lastEnemySpawnTime > enemySpawnInterval) {
        createEnemyCar();
        lastEnemySpawnTime = currentTime;
    }

    // Spawn coins
    if (currentTime - lastCoinSpawnTime > coinSpawnInterval) {
        createCoin();
        lastCoinSpawnTime = currentTime;
    }

    // Move and manage enemy cars
    enemyCars.forEach((car, index) => {
        let currentTop = parseFloat(car.style.top);
        car.style.top = `${currentTop + carSpeed}px`;

        if (currentTop > road.offsetHeight) {
            car.remove();
            enemyCars.splice(index, 1);
            score++;
            scoreDisplay.textContent = `Score: ${score}`;

            // Increase difficulty
            if (score % 10 === 0 && carSpeed < 15) {
                carSpeed += 0.5;
            }
            if (score % 20 === 0 && enemySpawnInterval > 500) {
                enemySpawnInterval -= 100;
            }
        }

        // Collision with player car
        if (checkCollision(playerCar, car)) {
            gameOver();
        }
    });

    // Move and manage coins
    coinsOnRoad.forEach((coin, index) => {
        let currentTop = parseFloat(coin.style.top);
        coin.style.top = `${currentTop + carSpeed}px`;

        if (currentTop > road.offsetHeight) {
            coin.remove();
            coinsOnRoad.splice(index, 1);
        }

        // Coin collection
        if (checkCollision(playerCar, coin)) {
            coin.remove();
            coinsOnRoad.splice(index, 1);
            coins++;
            score += 5; // Extra points for collecting coin
            coinDisplay.textContent = `Coins: ${coins}`;
            scoreDisplay.textContent = `Score: ${score}`;
        }
    });

    animationFrameId = requestAnimationFrame(gameLoop);
}

function createEnemyCar() {
    const enemyCar = document.createElement('img');
    enemyCar.src = `images/e${Math.floor(Math.random() * 3) + 1}.png`; // Assuming e1.png, e2.png, e3.png
    enemyCar.classList.add('enemy-car');

    const randomLeft = Math.random() * (100 - ENEMY_CAR_WIDTH_PERCENT);
    enemyCar.style.left = `${randomLeft}%`;
    enemyCar.style.top = `-100px`; // Start off-screen

    road.appendChild(enemyCar);
    enemyCars.push(enemyCar);
}

function createCoin() {
    const coinElement = document.createElement('img');
    coinElement.src = 'images/coin.png';
    coinElement.classList.add('coin');

    const randomLeft = Math.random() * (100 - COIN_WIDTH_PERCENT);
    coinElement.style.left = `${randomLeft}%`;
    coinElement.style.top = `-50px`; // Start off-screen

    road.appendChild(coinElement);
    coinsOnRoad.push(coinElement);
}

function checkCollision(element1, element2) {
    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();

    return !(
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom ||
        rect1.right < rect2.left ||
        rect1.left > rect2.right
    );
}

// On-screen touch controls
road.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent default touch behavior (like scrolling)
    const touchX = e.touches[0].clientX;
    const roadRect = road.getBoundingClientRect();

    if (touchX < roadRect.left + roadRect.width / 2) {
        // Tap on left side
        playerCarSpeed = -1;
    } else {
        // Tap on right side
        playerCarSpeed = 1;
    }
}, { passive: false }); // Use passive: false to allow preventDefault

road.addEventListener('touchend', (e) => {
    e.preventDefault(); // Prevent default touch behavior
    playerCarSpeed = 0; // Stop car movement when touch ends
}, { passive: false });


// Initial setup
playerCar.style.bottom = `${PLAYER_CAR_BOTTOM_OFFSET}px`;
playerCar.style.left = `${playerCarX}%`;

startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);



