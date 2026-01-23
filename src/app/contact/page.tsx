"use client";
import React, { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useAdminContacts } from "@/hooks/contactHooks";
import { ADMIN_LEVEL_ID, ELEVATED_LEVEL_ID} from "@/config/roles";
import { translations } from "@/lib/translations/contactInformation";
import ContactList from "@/components/contact-information/ContactList";
import ContactForm from "@/components/contact-information/ContactForm"

const ContactPage: React.FC = () => {
  const { language } = useLanguage();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { getContacts, addContact, deleteContact, reorderContacts, loading, error } = useAdminContacts();

  const [contacts, setContacts] = useState<
    { _id: string; name: string; title: string; email: string, avatarUrl?: string, position?: number }[]
  >([]);

  const [newContact, setNewContact] = useState({ name: "", title: "", email: "" });
  const [errorMessage, setErrorMessage] = useState<string | null>(null); 
  const t = translations[language] || translations.fi;
  const adminLevels = [ADMIN_LEVEL_ID, ELEVATED_LEVEL_ID];
  const isAdmin =
    isAuthenticated && !authLoading && user && adminLevels.includes(Number(user.user_level_id));

  // Fetch contacts once on mount
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await getContacts();
        console.log("Fetched contacts:", res);
        if (res && "contacts" in res) setContacts(res.contacts);
      } catch (err) {
        console.error("Error loading contacts:", err);
        setErrorMessage(t.error);
      }
    };
    fetchContacts();
  }, []);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name.trim() || !newContact.title.trim() || !newContact.email.trim()) return;

    try {
      const res = await addContact(newContact);
      if (res?.contact) {
        setContacts((prev) => [...prev, res.contact]);
        setNewContact({ name: "", title: "", email: "" });
      }
    } catch (err) {
      console.error("Error adding contact:", err);
    }
  };

  const handleReorderContacts = async (reordered: typeof contacts) => {
    setContacts(reordered);
  
    try {
      await reorderContacts(reordered.map((c) => c._id));
    } catch (err) {
      console.error("Failed to save new order:", err);
    }
  };
  

  const handleRemoveContact = async (id: string) => {
    if (!window.confirm(t.confirmRemove)) return;
    try {
      const res = await deleteContact(id);
      if (res?.success) {
        setContacts((prev) => prev.filter((c) => c._id !== id));
      }
    } catch (err) {
      console.error("Error deleting contact:", err);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto mt-6 text-[var(--typography)]">
      <h2 className="text-2xl font-semibold text-center mb-6">{t.title}</h2>
      {isAdmin && <p className="text-center mb-4 italic">{t.adminCanDrag}</p>}

      {loading && <p className="text-center text-[var(--typography)]">{t.loading}</p>}
      {error && <p className="text-center text-red-500">{t.error}</p>}

      {isAdmin && (
        <div className="mb-8">
        <ContactForm
          newContact={newContact}
          setNewContact={setNewContact}
          onSubmit={handleAddContact}
          loading={loading}
          t={t}
        />
        </div>
      )}


      <ContactList
        onReorder={isAdmin ? handleReorderContacts : undefined}
        contacts={contacts.map(contact => ({ ...contact, position: contact.position ?? 0 }))}
        isAdmin={isAdmin || false}
        onRemove={handleRemoveContact}
        t={t}
      />
    </div>
  );
};

export default ContactPage;
