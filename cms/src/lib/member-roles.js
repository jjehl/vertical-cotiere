const directoryRoles={basic:'authenticated',contributor:'contributor',admin:'member_admin'};
const memberTypes=Object.values(directoryRoles);
const canContribute=user=>!user?.blocked&&['contributor','member_admin'].includes(user?.role?.type);
module.exports={directoryRoles,memberTypes,canContribute};
