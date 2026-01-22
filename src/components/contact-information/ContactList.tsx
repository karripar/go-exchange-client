import React from "react";
import ContactItem from "./ContactItem";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface Contact {
  _id: string;
  name: string;
  title: string;
  email: string;
  avatarUrl?: string;
}

interface ContactListProps {
  contacts: Contact[];
  isAdmin: boolean;
  onRemove: (id: string) => void;
  onReorder?: (contacts: Contact[]) => void; // new prop for reordering
  t: Record<string, string>;
}

const ContactList: React.FC<ContactListProps> = ({
  contacts,
  isAdmin,
  onRemove,
  onReorder,
  t,
}) => {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const reordered = Array.from(contacts);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);

    if (onReorder) onReorder(reordered);
  };

  if (!isAdmin || !onReorder) {
    // Regular users: static list
    return (
      <ul className="space-y-4 mb-8">
        {contacts.map((contact) => (
          <ContactItem
            key={contact._id}
            contact={contact}
            isAdmin={isAdmin}
            onRemove={onRemove}
            t={t}
          />
        ))}
      </ul>
    );
  }

  // Admin: draggable list
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="contacts">
        {(provided) => (
          <ul
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="space-y-4 mb-8"
          >
            {contacts.map((contact, index) => (
              <Draggable key={contact._id} draggableId={contact._id} index={index}>
                {(provided, snapshot) => (
                  <li
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`${
                      snapshot.isDragging ? "bg-gray-100 shadow" : ""
                    } rounded transition`}
                  >
                    <ContactItem
                      contact={contact}
                      isAdmin={isAdmin}
                      onRemove={onRemove}
                      t={t}
                    />
                  </li>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </ul>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default ContactList;
