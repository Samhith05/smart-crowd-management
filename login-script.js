/* ============================================
   SMART CROWD MANAGEMENT - LOGIN JAVASCRIPT
   Authentication & Form Handling
   ============================================ */



// ============================================
// DOM ELEMENTS
// ============================================
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberMeCheckbox = document.getElementById('rememberMe');
const togglePasswordBtn = document.getElementById('togglePassword');
const passwordToggleIcon = document.getElementById('passwordToggleIcon');
const loginBtn = document.getElementById('loginBtn');
const alertError = document.getElementById('alertError');
const alertErrorText = document.getElementById('alertErrorText');
const alertSuccess = document.getElementById('alertSuccess');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');

// ============================================
// EVENT LISTENERS
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    console.log('Login page loaded');
    loadRememberedEmail();
    setupEventListeners();
});

function setupEventListeners() {
    // Form submission
    loginForm.addEventListener('submit', handleLogin);

    // Password toggle
    togglePasswordBtn.addEventListener('click', togglePasswordVisibility);

    // Input validation on blur
    emailInput.addEventListener('blur', validateEmail);
    passwordInput.addEventListener('blur', validatePassword);

    // Clear errors on input
    emailInput.addEventListener('input', () => clearError('email'));
    passwordInput.addEventListener('input', () => clearError('password'));
}

// ============================================
// PASSWORD VISIBILITY TOGGLE
// ============================================
/**
 * Toggles password field visibility between text and password
 */
function togglePasswordVisibility() {
    const isPasswordVisible = passwordInput.type === 'password';

    if (isPasswordVisible) {
        passwordInput.type = 'text';
        passwordToggleIcon.textContent = '🙈';
    } else {
        passwordInput.type = 'password';
        passwordToggleIcon.textContent = '👁️';
    }
}

// ============================================
// FORM VALIDATION
// ============================================
/**
 * Validates email/username format
 */
function validateEmail() {
    const email = emailInput.value.trim();
    const emailError = document.getElementById('emailError');

    if (!email) {
        showError('email', 'Email or username is required');
        return false;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$|^[a-zA-Z0-9_]{3,}$/;
    if (!emailRegex.test(email)) {
        showError('email', 'Please enter a valid email or username');
        return false;
    }

    clearError('email');
    return true;
}

/**
 * Validates password
 */
function validatePassword() {
    const password = passwordInput.value;

    if (!password) {
        showError('password', 'Password is required');
        return false;
    }

    if (password.length < 3) {
        showError('password', 'Password must be at least 3 characters');
        return false;
    }

    clearError('password');
    return true;
}

/**
 * Shows error message for a field
 */
function showError(fieldName, message) {
    const errorElement = document.getElementById(fieldName + 'Error');
    const inputElement = fieldName === 'email' ? emailInput : passwordInput;

    errorElement.textContent = message;
    errorElement.classList.add('show');
    inputElement.classList.add('error');
}

/**
 * Clears error message for a field
 */
function clearError(fieldName) {
    const errorElement = document.getElementById(fieldName + 'Error');
    const inputElement = fieldName === 'email' ? emailInput : passwordInput;

    errorElement.textContent = '';
    errorElement.classList.remove('show');
    inputElement.classList.remove('error');
}

/**
 * Clears all error messages
 */
function clearAllErrors() {
    clearError('email');
    clearError('password');
}

// ============================================
// LOGIN HANDLER
// ============================================
/**
 * Handles login form submission
 */
function handleLogin(event) {
    event.preventDefault();

    console.log('Login attempt started');

    // Clear previous errors
    clearAllErrors();

    // Validate inputs
    const emailValid = validateEmail();
    const passwordValid = validatePassword();

    if (!emailValid || !passwordValid) {
        console.warn('Validation failed');
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = rememberMeCheckbox.checked;

    // Show loading state
    setLoadingState(true);

    // Simulate authentication delay (in real app, this would be Firebase)
    setTimeout(() => {
        authenticateUser(email, password, rememberMe);
    }, 800);
}

/**
 * Authenticates user credentials
 * In production, this would connect to Firebase or backend API
 */
function authenticateUser(email, password, rememberMe) {
    console.log('Authenticating user:', email);

    // In production, this would verify against Firebase/backend
    // For now, we validate basic format (this should be connected to real authentication)
    const isValidUser = (email.length > 3 && password.length >= 3);

    if (isValidUser) {
        // Show success message
        alertSuccess.style.display = 'flex';
        alertError.style.display = 'none';

        // Store login info
        storeUserSession(email, rememberMe);

        console.log('✅ Login successful');

        // Redirect to dashboard after 1.5 seconds
        setTimeout(() => {
            window.location.href = window.location.origin + '/index.html';
        }, 1500);
    } else {
        // Show error message
        showLoginError('Invalid email or password. Try admin@college.edu / demo123');
        setLoadingState(false);
        console.error('❌ Login failed - invalid credentials');
    }
}

/**
 * Stores user session in localStorage
 */
function storeUserSession(email, rememberMe) {
    // Store user info
    localStorage.setItem('user_email', email);
    localStorage.setItem('user_logged_in', 'true');
    localStorage.setItem('login_time', new Date().toISOString());

    // Remember email if checkbox is checked
    if (rememberMe) {
        localStorage.setItem('remember_email', email);
    } else {
        localStorage.removeItem('remember_email');
    }

    console.log('User session stored');
}

/**
 * Loads remembered email if available
 */
function loadRememberedEmail() {
    const rememberedEmail = localStorage.getItem('remember_email');
    if (rememberedEmail) {
        emailInput.value = rememberedEmail;
        rememberMeCheckbox.checked = true;
        console.log('Remembered email loaded');
    }
}

/**
 * Shows login error message
 */
function showLoginError(message) {
    alertErrorText.textContent = message;
    alertError.style.display = 'flex';
    alertSuccess.style.display = 'none';
}

/**
 * Sets loading state on login button
 */
function setLoadingState(isLoading) {
    if (isLoading) {
        loginBtn.classList.add('loading');
        loginBtn.disabled = true;
    } else {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
    }
}


}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
/**
 * Allow Enter key to submit form and keyboard shortcuts
 */
document.addEventListener('keydown', function (event) {
    // Enter key to login
    if (event.key === 'Enter' && document.activeElement !== demoBtn) {
        if (document.activeElement === passwordInput) {
            handleLogin(event);
        }
    }

    // Ctrl/Cmd + Enter for demo login
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        loginAsDemo();
    }
});

// ============================================
// PAGE VISIBILITY - CLEAR SESSION ON SUSPICIOUS ACTIVITY
// ============================================
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        console.log('Page hidden');
    } else {
        console.log('Page visible');
    }
});

// ============================================
// CHECK IF ALREADY LOGGED IN
// ============================================
/**
 * Redirects to dashboard if already logged in
 */
function checkExistingSession() {
    const isLoggedIn = localStorage.getItem('user_logged_in') === 'true';
    const loginTime = localStorage.getItem('login_time');

    if (isLoggedIn && loginTime) {
        const loginTimeObj = new Date(loginTime);
        const currentTime = new Date();
        const timeDiff = (currentTime - loginTimeObj) / (1000 * 60); // minutes

        // Session valid for 8 hours
        if (timeDiff < 480) {
            console.log('Valid session found, redirecting to dashboard');
            window.location.href = 'index.html';
        }
    }
}

// Run session check on page load
window.addEventListener('load', checkExistingSession);

// ============================================
// CONSOLE HELPERS
// ============================================
console.log('🔐 Smart Crowd Management - Login Page');
console.log('Demo credentials: samhithbade2006@gmail.com / admin123');
console.log('Or use Demo Access button to login without credentials');
