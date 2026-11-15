// Member JWTs must never grant import/export privileges, even after a role change.
module.exports=ctx=>ctx.state.auth?.strategy?.name==='content-api-token';
