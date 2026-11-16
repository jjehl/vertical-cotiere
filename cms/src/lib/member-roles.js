const memberTypes=['authenticated','contributor','member_admin'];
const canContribute=user=>!user?.blocked&&['contributor','member_admin'].includes(user?.role?.type);
module.exports={memberTypes,canContribute};
