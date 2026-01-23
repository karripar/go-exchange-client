import Image from "next/image";
import React from "react";

interface ContactItemProps {
  contact: {
    _id: string;
    name: string;
    title: string;
    email: string;
    avatarUrl?: string;
    position?: number;
  };
  isAdmin: boolean;
  onRemove: (id: string) => void;
  t: Record<string, string>;
}

const ContactItem: React.FC<ContactItemProps> = ({ contact, isAdmin, onRemove, t }) => {
  return (
    <div className="flex items-center border border-gray-300 rounded-xl p-4 mb-4">
      
      {isAdmin && typeof contact.position === "number" && (
        <div className="mr-4 text-gray-500 font-semibold text-lg w-6 text-center select-none">
          {contact.position}
        </div>
      )}

      <div className="flex justify-between items-center w-full">
        <div>
          <p className="font-medium">{contact.name}</p>
          <p className="text-sm italic text-[var(--typography)]">{contact.title}</p>
          <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
            {contact.email}
          </a>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Image
            src={contact.avatarUrl || "/images/default-avatar.png"}
            alt={`${contact.name} avatar`}
            width={75}
            height={75}
            className="rounded-full"
          />

          {isAdmin && (
            <button
              onClick={() => onRemove(contact._id)}
              className="text-red-600 hover:underline"
            >
              {t.remove}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


export default ContactItem;
