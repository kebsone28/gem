/**
 * Shared Theme Toggle Logic for Antigravity
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial State
    if (localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }

    // 2. Add Toggle Button to Nav (proactively find a place in the nav)
    const navRight = document.querySelector('nav .flex.items-center.space-x-4');
    if (navRight) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-all text-white outline-none';
        toggleBtn.innerHTML = document.documentElement.classList.contains('dark') ?
            '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

        toggleBtn.onclick = () => {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            toggleBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        };

        navRight.appendChild(toggleBtn);
    }
});
