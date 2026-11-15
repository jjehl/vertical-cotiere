import React from 'react';
import { useRBAC } from '@strapi/strapi/admin';
import { useNavigate } from 'react-router-dom';
import { Button } from '@strapi/design-system';

const permissions=[
  {action:'plugin::publication-assistant.use',subject:null},
  {action:'plugin::content-manager.explorer.read',subject:'api::publication.publication'},
  {action:'plugin::content-manager.explorer.update',subject:'api::publication.publication'},
];

function useAssistantAction({model,documentId}) {
  const navigate=useNavigate();
  const {allowedActions,isLoading}=useRBAC(permissions);
  if(model!=='api::publication.publication'||!documentId||isLoading||!allowedActions.canUse||!allowedActions.canRead||!allowedActions.canUpdate)return null;
  return {
    label:'Modifier avec l’assistant IA',
    onClick:()=>navigate('/plugins/publication-assistant?documentId='+encodeURIComponent(documentId)),
  };
}

export function EditWithAssistant(props) {
  const action=useAssistantAction(props);
  return action?{...action,position:'table-row'}:null;
}
EditWithAssistant.position='table-row';

export function AssistantPanel(props) {
  const action=useAssistantAction(props);
  return action?{title:'Assistant IA',content:<Button variant="secondary" onClick={action.onClick}>{action.label}</Button>}:null;
}
