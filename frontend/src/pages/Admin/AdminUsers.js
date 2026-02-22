import React, { useEffect, useState, useCallback } from 'react';
import { adminAPI } from '../../utils/api';
import ErrorMessage from '../../components/ui/ErrorMessage';
import Loading from '../../components/ui/Loading';
import { useAuth } from '../../context/AuthContext';
import { handleApiError } from '../../utils/helpers';
import './AdminUsers.css';

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const { user: currentUser } = useAuth();

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const res = await adminAPI.getUsers({ search, role: roleFilter });
            setUsers(res.data.users || []);
            setError('');
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setLoading(false);
        }
    }, [search, roleFilter]);

    useEffect(() => {
        // debounce search slightly
        const timer = setTimeout(() => {
            fetchUsers();
        }, 400);
        return () => clearTimeout(timer);
    }, [fetchUsers]);

    const handleRoleChange = async (userId, newRole) => {
        try {
            if (!window.confirm(`Change user role to ${newRole}?`)) return;
            await adminAPI.updateUserRole(userId, newRole);
            setSuccess('Role updated successfully.');
            fetchUsers();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(handleApiError(err));
        }
    };

    const handleDeleteUser = async (userId, name) => {
        try {
            if (!window.confirm(`Are you absolutely sure you want to delete ${name}? This cannot be undone.`)) return;
            await adminAPI.deleteUser(userId);
            setSuccess('User deleted successfully.');
            fetchUsers();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(handleApiError(err));
        }
    };

    if (!currentUser || currentUser.role !== 'admin') {
        return <ErrorMessage message="Unauthorized access. Admin only." />;
    }

    return (
        <div className="admin-page">
            <div className="admin-container">
                <div className="admin-header">
                    <h1>User Management</h1>
                    <p>View and manage all system users (Students, Staff, Admins)</p>
                </div>

                {error && <ErrorMessage message={error} onClose={() => setError('')} />}
                {success && <div className="admin-success">{success}</div>}

                <div className="admin-controls">
                    <input
                        type="text"
                        className="admin-search"
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                        className="admin-filter"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                    >
                        <option value="">All Roles</option>
                        <option value="student">Student</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>

                {loading ? (
                    <Loading />
                ) : (
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Dept</th>
                                    <th>Points</th>
                                    <th>Role</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="admin-no-data">No users found.</td>
                                    </tr>
                                ) : (
                                    users.map((u) => (
                                        <tr key={u._id}>
                                            <td className="fw-600">{u.name}</td>
                                            <td>{u.email}</td>
                                            <td>{u.department}</td>
                                            <td>{u.points || 0}</td>
                                            <td>
                                                <select
                                                    className={`form-select role-select role-${u.role}`}
                                                    value={u.role}
                                                    onChange={(e) => handleRoleChange(u._id, e.target.value)}
                                                    disabled={u._id === currentUser.id} // cannot change own role easily here
                                                >
                                                    <option value="student">Student</option>
                                                    <option value="staff">Staff</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </td>
                                            <td>
                                                <button
                                                    className="btn-delete-sm"
                                                    onClick={() => handleDeleteUser(u._id, u.name)}
                                                    disabled={u._id === currentUser.id}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminUsers;
