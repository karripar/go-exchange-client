"use client";
import fetchData from "@/lib/fetchData";
import { useState } from "react";
import { ApplicationDocument } from "va-hybrid-types/contentTypes";

/**
 * Validate document link based on source type
 * More flexible validation - checks if URL is valid https link
 */
const validateDocumentLink = (url: string): boolean => {
  // Basic URL validation
  if (!url || typeof url !== 'string') return false;

  // return true if valid https link
  return /^https?:\/\/.+/.test(url);
  
};


/**
 * Hook for managing profile documents (separate from application documents)
 */
const useProfileDocuments = () => {
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Add a document link to profile
   */
  const addDocumentLink = async (data: {
    name: string;
    url: string;
    sourceType: string;
    notes?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      // Validating the link before submission (non-strict mode)
      if (!validateDocumentLink(data.url)) {
        throw new Error('Invalid document link format');
      }

      const apiUrl = process.env.NEXT_PUBLIC_UPLOAD_API;
      if (!apiUrl) {
        throw new Error("Upload API URL not configured");
      }

      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('You must be logged in to add documents. Please log in and try again.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      console.log('Adding document link to:', `${apiUrl}/linkUploads/documents/link`);
      console.log('Token present:', !!token);

      const response = await fetch(`${apiUrl}/linkUploads/documents/link`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to add document (${response.status})`);
      }

      const addedDocument = await response.json();
      setDocuments(prev => [...prev, addedDocument]);
      
      return addedDocument;
    } catch (err: unknown) {
      console.error("Error adding document link:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to add document link";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete a profile document
   */
  const deleteDocument = async (documentId: string) => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = process.env.NEXT_PUBLIC_UPLOAD_API;
      if (!apiUrl) {
        throw new Error("Upload API URL not configured");
      }

      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
      };

      const response = await fetch(`${apiUrl}/linkUploads/documents/${documentId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        const error = await response.json().catch(() => ({ error: 'Failed to remove document' }));
        throw new Error(error.error || `Failed to remove document (${response.status})`);
      }

      // Filter by both id and _id for MongoDB compatibility
      setDocuments(prev => prev.filter(doc => {
        const docId = (doc as { _id?: string; id: string })._id || doc.id;
        return docId !== documentId;
      }));
    } catch (err: unknown) {
      console.error("Error deleting document:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to delete document";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch all profile documents
   */
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = process.env.NEXT_PUBLIC_UPLOAD_API;
      if (!apiUrl) {
        throw new Error("Upload API URL not configured");
      }

      const data = await fetchData<ApplicationDocument[]>(`${apiUrl}/linkUploads/documents`);
      setDocuments(data);
    } catch (err: unknown) {
      console.error("Error fetching documents:", err);
      setError("Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  };

  return {
    documents,
    loading,
    error,
    addDocumentLink,
    deleteDocument,
    fetchDocuments
  };
};

export { useProfileDocuments };