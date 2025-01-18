function wrapText(text, maxWidth) {
    const lines = [];
    const words = text.split(' ')
    let currentLine = ''
    
    // Create a temporary element for measuring
    const temp = document.createElement('div')
    temp.style.cssText = `
        font-family: 'Old Standard TT', serif;
        font-size: 1.0rem;
        position: absolute;
        visibility: hidden;
        white-space: nowrap;
        padding: 0 0px;
    `
    document.body.appendChild(temp)

    // Process each word
    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        temp.textContent = testLine
        
        if (temp.offsetWidth <= maxWidth + 20) {
            currentLine = testLine
        } else {
            if (currentLine) {
                lines.push(currentLine)
            }
            currentLine = word
        }
    }
    
    if (currentLine) {
        lines.push(currentLine)
    }

    document.body.removeChild(temp)
    return lines.join('\n')
}

function typewriterEffect(message, elementId, speed = 50) {
    const element = document.getElementById(elementId)
    if (!element) return
    
    element.textContent = ''
    element.classList.add('typing')
    let index = 0
    
    function type() {
        if (index < message.length) {
            element.textContent += message.charAt(index)
            index++
            setTimeout(type, speed)
        } else {
            element.classList.remove('typing')
        }
    }
    
    type()
}

function updateGameMessage(message, useTypewriter = false, speed = 50) {
    const messageElement = document.getElementById('game-message')
    if (messageElement) {
        const container = document.getElementById('message-container')
        const maxWidth = container.clientWidth - 40
        const wrappedMessage = wrapText(message, maxWidth)
        
        if (useTypewriter) {
            typewriterEffect(wrappedMessage, 'game-message', speed)
        } else {
            messageElement.textContent = wrappedMessage
        }
    }
}

export {
    updateGameMessage
}