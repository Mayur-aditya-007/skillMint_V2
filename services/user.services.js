const userModel = require("../models/user.model");

/**
 * Create a new user with proper validation and error handling
 * @param {Object} userData - User data object
 * @param {string} userData.firstname - User's first name
 * @param {string} userData.lastname - User's last name (optional)
 * @param {string} userData.email - User's email address
 * @param {string} userData.password - User's hashed password
 * @returns {Promise<Object>} Created user object
 * @throws {Error} If validation fails or user creation fails
 */
module.exports.createUser = async ({ firstname, lastname, email, password }) => {
    try {
        // Enhanced validation
        if (!firstname || !email || !password) {
            throw new Error("First name, email, and password are required");
        }

        // Validate email format (basic check)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error("Invalid email format");
        }

        // Validate first name length (matching your model validation)
        if (firstname.length < 3) {
            throw new Error("First name must be at least 3 characters long");
        }

        // Validate last name if provided (matching your model validation)
        if (lastname && lastname.length < 3) {
            throw new Error("Last name must be at least 3 characters long");
        }

        // Check if user already exists
        const existingUser = await userModel.findOne({ 
            email: email.toLowerCase().trim() 
        });
        
        if (existingUser) {
            throw new Error("User with this email already exists");
        }

        // Create user with proper structure matching your schema
        const userData = {
            fullname: {
                firstname: firstname.trim(),
                lastname: lastname ? lastname.trim() : undefined
            },
            email: email.toLowerCase().trim(),
            password: password, // Should already be hashed when passed to this service
            enrolledCourses: [] // Initialize empty enrolled courses array
        };

        // Use await to properly handle the promise
        const user = await userModel.create(userData);
        
        // Return user without password for security
        const userResponse = user.toObject();
        delete userResponse.password;
        
        return userResponse;

    } catch (error) {
        // Log error for debugging (remove in production or use proper logging)
        console.error("Error in createUser service:", error.message);
        
        // Re-throw with more context if it's a validation error
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }
        
        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            throw new Error("User with this email already exists");
        }
        
        // Re-throw the original error
        throw error;
    }
};

/**
 * Find user by email
 * @param {string} email - User's email address
 * @returns {Promise<Object|null>} User object or null if not found
 */
module.exports.findUserByEmail = async (email) => {
    try {
        if (!email) {
            throw new Error("Email is required");
        }

        const user = await userModel.findOne({ 
            email: email.toLowerCase().trim() 
        }).select('+password'); // Include password for authentication

        return user;
    } catch (error) {
        console.error("Error in findUserByEmail service:", error.message);
        throw error;
    }
};

/**
 * Find user by ID
 * @param {string} userId - User's ID
 * @returns {Promise<Object|null>} User object or null if not found
 */
module.exports.findUserById = async (userId) => {
    try {
        if (!userId) {
            throw new Error("User ID is required");
        }

        const user = await userModel.findById(userId)
            .select('-password'); // Exclude password by default

        return user;
    } catch (error) {
        console.error("Error in findUserById service:", error.message);
        throw error;
    }
};

/**
 * Update user profile
 * @param {string} userId - User's ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated user object
 */
module.exports.updateUser = async (userId, updateData) => {
    try {
        if (!userId) {
            throw new Error("User ID is required");
        }

        // Remove sensitive fields that shouldn't be updated directly
        const { password, email, ...safeUpdateData } = updateData;

        const user = await userModel.findByIdAndUpdate(
            userId, 
            safeUpdateData, 
            { 
                new: true, // Return updated document
                runValidators: true // Run schema validations
            }
        ).select('-password');

        if (!user) {
            throw new Error("User not found");
        }

        return user;
    } catch (error) {
        console.error("Error in updateUser service:", error.message);
        
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }
        
        throw error;
    }
};

/**
 * Delete user account
 * @param {string} userId - User's ID
 * @returns {Promise<boolean>} Success status
 */
module.exports.deleteUser = async (userId) => {
    try {
        if (!userId) {
            throw new Error("User ID is required");
        }

        const result = await userModel.findByIdAndDelete(userId);
        
        return !!result; // Return true if user was deleted, false otherwise
    } catch (error) {
        console.error("Error in deleteUser service:", error.message);
        throw error;
    }
};

/**
 * Get user statistics
 * @param {string} userId - User's ID
 * @returns {Promise<Object>} User statistics
 */
module.exports.getUserStats = async (userId) => {
    try {
        if (!userId) {
            throw new Error("User ID is required");
        }

        const user = await userModel.findById(userId);
        
        if (!user) {
            throw new Error("User not found");
        }

        const totalCourses = user.enrolledCourses.length;
        const completedCourses = user.enrolledCourses.filter(course => course.isCompleted).length;
        const inProgressCourses = totalCourses - completedCourses;
        const averageProgress = totalCourses > 0 
            ? user.enrolledCourses.reduce((sum, course) => sum + course.progress, 0) / totalCourses 
            : 0;

        return {
            totalCourses,
            completedCourses,
            inProgressCourses,
            averageProgress: Math.round(averageProgress * 100) / 100, // Round to 2 decimal places
            accountCreated: user.createdAt,
            lastUpdated: user.updatedAt
        };
    } catch (error) {
        console.error("Error in getUserStats service:", error.message);
        throw error;
    }
};