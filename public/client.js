const socket = io();

const boardDiv = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const statusEl = document.getElementById('status');
const symbolInfoEl = document.getElementById('symbol-info');

let mySymbol = null; // لتخزين رمز اللاعب الحالي (X أو O)

cells.forEach(cell => {
    cell.addEventListener('click', () => {
        // نرسل رقم المربع الذي تم النقر عليه إلى الخادم
        socket.emit('move', parseInt(cell.dataset.index));
    });
});

socket.on('start', (data) => {
    mySymbol = data.symbol; // نحدد رمز هذا العميل
    symbolInfoEl.textContent = `أنت تلعب بالرمز: ${mySymbol}`;
    
    // عند بداية لعبة جديدة، نمسح أي تأثيرات فوز سابقة
    cells.forEach(cell => {
        cell.classList.remove('winner-x', 'winner-o');
    });
});

socket.on('update', (data) => {
    // تحديث اللوحة
    data.board.forEach((value, index) => {
        cells[index].textContent = value;
        // إزالة الكلاسات القديمة
        cells[index].classList.remove('x', 'o');
        // إضافة الكلاس الجديد حسب الرمز
        if (value === 'X') cells[index].classList.add('x');
        if (value === 'O') cells[index].classList.add('o');
        
        // مسح كلاسات الفوز إذا كانت موجودة (مهم عند التحديث بعد حركة عادية)
        cells[index].classList.remove('winner-x', 'winner-o');
    });

    // تحديث رسالة الدور
    if (data.turn) {
        if (data.turn === mySymbol) {
            statusEl.textContent = 'دورك للعب';
        } else {
            statusEl.textContent = `انتظار دور ${data.turn}`;
        }
    } else {
        // إذا كان data.turn null، فهذا يعني أن اللعبة انتهت (فوز أو تعادل)
        // لا نغير الرسالة هنا، الخادم سيرسل رسالة الفوز
    }
    
    // ⭐⭐ جديد: تطبيق ألوان المربعات الفائزة إذا تم إرسالها من الخادم ⭐⭐
    // يجب على الخادم إرسال 'winningLine' مع الفائز عند انتهاء اللعبة
    if (data.winningLine && data.winner) {
        data.winningLine.forEach(index => {
            if (data.winner === 'X') {
                cells[index].classList.add('winner-x');
            } else if (data.winner === 'O') {
                cells[index].classList.add('winner-o');
            }
        });
    }
});

socket.on('message', (message) => {
    statusEl.textContent = message;
    if (message.includes('انتظار')) {
        symbolInfoEl.textContent = '';
        mySymbol = null;
        // عند انتظار لاعب جديد، نمسح اللوحة بالكامل
        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('x', 'o', 'winner-x', 'winner-o');
        });
    }
});
