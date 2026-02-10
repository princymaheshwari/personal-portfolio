
// Footer Particles initialization  
particlesJS("particles-footer", {
    "particles": {
        "number": { "value": 30 },
        "color": { "value": "#1DCD9F" },
        "shape": { "type": "circle" },
        "opacity": {
            "value": 0.4,
            "random": true
        },
        "size": {
            "value": 2,
            "random": true
        },
        "line_linked": {
            "enable": true,
            "distance": 120,
            "color": "#1DCD9F",
            "opacity": 0.25,
            "width": 1
        },
        "move": {
            "enable": true,
            "speed": 1.5,
            "direction": "none",
            "out_mode": "out"
        }
    },
    "interactivity": {
        "detect_on": "canvas",
        "events": {
            "onhover": { "enable": false },
            "onclick": { "enable": false }
        }
    },
    "retina_detect": true
});

// Journey Section Particles
particlesJS("particles-journey", {
    "particles": {
        "number": { "value": 30 },
        "color": { "value": "#1DCD9F" },
        "shape": { "type": "circle" },
        "opacity": {
            "value": 0.4,
            "random": true
        },
        "size": {
            "value": 2,
            "random": true
        },
        "line_linked": {
            "enable": true,
            "distance": 120,
            "color": "#1DCD9F",
            "opacity": 0.25,
            "width": 1
        },
        "move": {
            "enable": true,
            "speed": 1.5,
            "direction": "none",
            "out_mode": "out"
        }
    },
    "interactivity": {
        "detect_on": "canvas",
        "events": {
            "onhover": { "enable": false },
            "onclick": { "enable": false }
        }
    },
    "retina_detect": true
});

// About Section Particles
particlesJS("particles-about", {
    "particles": {
        "number": { "value": 30 },
        "color": { "value": "#1DCD9F" },
        "shape": { "type": "circle" },
        "opacity": {
            "value": 0.4,
            "random": true
        },
        "size": {
            "value": 2,
            "random": true
        },
        "line_linked": {
            "enable": true,
            "distance": 120,
            "color": "#1DCD9F",
            "opacity": 0.25,
            "width": 1
        },
        "move": {
            "enable": true,
            "speed": 1.5,
            "direction": "none",
            "out_mode": "out"
        }
    },
    "interactivity": {
        "detect_on": "canvas",
        "events": {
            "onhover": { "enable": false },
            "onclick": { "enable": false }
        }
    },
    "retina_detect": true
});

// Contact Section Particles
particlesJS("particles-contact", {
    "particles": {
        "number": { "value": 30 },
        "color": { "value": "#1DCD9F" },
        "shape": { "type": "circle" },
        "opacity": {
            "value": 0.4,
            "random": true
        },
        "size": {
            "value": 2,
            "random": true
        },
        "line_linked": {
            "enable": true,
            "distance": 120,
            "color": "#1DCD9F",
            "opacity": 0.25,
            "width": 1
        },
        "move": {
            "enable": true,
            "speed": 1.5,
            "direction": "none",
            "out_mode": "out"
        }
    },
    "interactivity": {
        "detect_on": "canvas",
        "events": {
            "onhover": { "enable": false },
            "onclick": { "enable": false }
        }
    },
    "retina_detect": true
});

// Matrix Rain Effect for Skills Section
(function () {
    const canvas = document.getElementById('matrix-rain');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Set canvas size
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Matrix characters - using programming symbols and binary
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン{}[]<>/\\|~`!@#$%^&amp;*()_+-=';
    const charArray = chars.split('');

    const fontSize = 20; // Increased to reduce density
    const columns = Math.floor(canvas.width / fontSize);
    const drops = Array(columns).fill(1);

    function draw() {
        // Semi-transparent black to create fade effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(29, 205, 159, 0.3)'; // Green color with reduced opacity
        ctx.font = `${fontSize}px monospace`;

        for (let i = 0; i < drops.length; i++) {
            // Random character
            const char = charArray[Math.floor(Math.random() * charArray.length)];
            const x = i * fontSize;
            const y = drops[i] * fontSize;

            ctx.fillText(char, x, y);

            // Reset drop to top randomly
            if (y > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }

    // Animation loop - increased interval for better performance
    setInterval(draw, 80);
})();
