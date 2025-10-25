const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// 1. نستخدم "Object" لتخزين اللاعبين لربط الـ socket بالرمز (X أو O)
let players = {
    'X': null,
    'O': null
};
let board = Array(9).fill(null);
let xStartedLast = false; 
let currentTurn;

// هذه الدالة تتحقق فقط إذا كان هناك فائز أو تعادل
function checkWinner() {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]  // Diagonals
    ];
    for (let line of lines) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // X or O
        }
    }
    return board.includes(null) ? null : 'T'; // T for Tie
}

// ⭐⭐ دالة جديدة لإرجاع المربعات الفائزة ⭐⭐
function getWinningLine() {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]  // Diagonals
    ];
    for (let line of lines) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return line; // إرجاع مصفوفة الأرقام التي فازت [a, b, c]
        }
    }
    return null;
}

function startGame() {
    board.fill(null);
    // تبديل البادئ
    xStartedLast = !xStartedLast;
    currentTurn = xStartedLast ? 'X' : 'O';

    // إرسال الرمز الصحيح لكل لاعب
    if (players['X']) {
        players['X'].emit('start', { symbol: 'X', turn: currentTurn });
    }
    if (players['O']) {
        players['O'].emit('start', { symbol: 'O', turn: currentTurn });
    }
    
    // إرسال لوحة اللعب المبدئية للجميع
    io.emit('update', { board: board, turn: currentTurn });
}

io.on('connection', (socket) => {
    
    // تعيين اللاعب لـ X أو O عند الاتصال
    let assignedSymbol = null;

    if (players['X'] === null) {
        assignedSymbol = 'X';
        players['X'] = socket;
        socket.emit('message', 'أنت اللاعب X. انتظار لاعب O...');
    } else if (players['O'] === null) {
        assignedSymbol = 'O';
        players['O'] = socket;
        socket.emit('message', 'أنت اللاعب O. اللعبة ستبدأ.');
    } else {
        // لو الخانات ممتلئة
        socket.emit('message', 'اللعبة ممتلئة. حاول لاحقاً.');
        socket.disconnect();
        return;
    }

    // التحقق إذا اكتمل اللاعبان لبدء اللعبة
    if (players['X'] && players['O']) {
        io.emit('message', 'تم العثور على لاعب! اللعبة ستبدأ.');
        startGame();
    }

    socket.on('move', (index) => {
        
        // التحقق أن اللعبة شغالة (لاعبان موجودان)
        // التحقق أن الرمز الخاص بهذا اللاعب (assignedSymbol) هو نفسه الدور الحالي (currentTurn)
        // التحقق أن المربع فارغ
        if (players['X'] && players['O'] && assignedSymbol === currentTurn && board[index] === null) {
            
            // إذا كل الشروط صحيحة، اقبل الحركة
            board[index] = currentTurn;
            const winner = checkWinner();

            if (winner && winner !== 'T') { // إذا كان هناك فائز وليس تعادلاً
                const winningLine = getWinningLine(); // الحصول على خط الفوز
                io.emit('update', { board: board, turn: null, winner: winner, winningLine: winningLine }); // إرسال خط الفوز للعميل
                io.emit('message', `اللاعب ${winner} فاز! اللعبة ستعاد.`);
                setTimeout(startGame, 3000); 
            } else if (winner === 'T') { // إذا كان تعادلاً
                io.emit('update', { board: board, turn: null });
                io.emit('message', 'تعادل! اللعبة ستعاد.');
                setTimeout(startGame, 3000);
            }
            else { // اللعبة مستمرة
                // تغيير الدور
                currentTurn = currentTurn === 'X' ? 'O' : 'X';
                io.emit('update', { board: board, turn: currentTurn });
            }
        }
        // إذا لم تتحقق الشروط (ليس دورك أو المربع ممتلئ)، الخادم سيتجاهل الحركة
    });

    socket.on('disconnect', () => {
        // تفريغ خانة اللاعب الذي خرج
        if (assignedSymbol) {
            players[assignedSymbol] = null; 
        }

        // إعادة ضبط اللعبة وإعلام اللاعب المتبقي (إن وجد)
        board.fill(null);
        io.emit('message', 'لاعب غادر. انتظار لاعب جديد...');
        // إرسال تحديث باللوحة الفارغة للاعب المتبقي
        if (players['X']) players['X'].emit('update', { board: board, turn: null });
        if (players['O']) players['O'].emit('update', { board: board, turn: null });
    });
});

// هذا السطر يعمل على ngrok/Replit/Render وعلى جهازك المحلي
server.listen(process.env.PORT || 3000, () => {
    console.log('Server is running on port 3000');
});